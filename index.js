"use strict";

// REQUIRES
var express = require('express');
var path = require('path');
var app = express();
var http = require('http').Server(app);
var child = require('child_process');
var io = require('socket.io')(http);
var fs = require('fs');
var bodyParser = require('body-parser');
var sqlite3 = require('sqlite3').verbose();
var db = new sqlite3.Database('router.db');
var async = require('async');

// RUNTIME VARIABLES
let listFileHostnames = [];
let listConnectedDevices = [];
let listConnectedDevicesWithInfo = [];
let listAllowedDevices = [];
let listKnownHostnames = [];
let listKnownDeviceInfo = [];
let listBlockedDevices = [];

// CONFIG
app.set('port', process.env.PORT || 3000);
app.set('view engine', 'jade');
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));

// ROUTES
// Render the app view
app.get('/', function(req, res) {
  res.render('index');
});

app.post('/remove', function(req, res) {
  let mac_address = req.body.mac_address;

  removeClient(mac_address);

  db.run("INSERT INTO devices(type, mac_address, timestamp_connected, is_blocked, snooze_period) VALUES($type, $mac_address, $timestamp_connected, $is_blocked, $snooze_period)", {
    $type: req.body.type,
    $mac_address: mac_address,
    $timestamp_connected: Math.floor(Date.now() / 1000),
    $is_blocked: 1,
    $snooze_period: 0
  }, function() {
    res.sendStatus(200);
  });
});

app.post('/ignore', function(req, res) {
  db.run("INSERT INTO devices(type, mac_address, timestamp_connected, is_blocked, snooze_period) VALUES($type, $mac_address, $timestamp_connected, $is_blocked, $snooze_period)", {
    $type: req.body.type,
    $mac_address: req.body.mac_address,
    $timestamp_connected: Math.floor(Date.now() / 1000),
    $is_blocked: 0,
    $snooze_period: 0
  }, function() {
    res.sendStatus(200);
  });
});

app.post('/unremove', function(req, res) {
  let mac_address = req.body.mac_address;

  // Unblock device in database
  db.run("UPDATE devices SET is_blocked = 0 WHERE mac_address = '" + mac_address + "'", function() {
    // Remove blocking line from dhcp configuration
    child.exec('sed -i".bak" \'/' + mac_address + '/d\' /etc/dhcp/dhcpd.conf', function(err, stdout, stderr) {
      // Restart DHCP server
      child.execFile('service', ['isc-dhcp-server', 'restart'], function(err, stdout, stderr) {
        console.log('unblocked ' + mac_address);
      });
    });
  });
});

// SOCKET.IO
// When the UI asked for an update, respond
io.on('connection', function (socket) {
  socket.on('update_call', function (data) {
    update();
  });
});

function update() {
  async.series([
    function(callback) {
      // Reset runtime variables
      listFileHostnames = [];
      listConnectedDevices = [];
      listConnectedDevicesWithInfo = [];
      listKnownHostnames = [];
      listKnownDeviceInfo = [];
      listBlockedDevices = [];

      callback();
    },
    function(callback) {
      // 1: Update database of hostnames

      child.execFile('cat', ['/var/lib/dhcp/dhcpd.leases'], function(err, stdout, stderr) {
        let leaseFile = stdout;

        // Split leases file into individual leases
        leaseFile = leaseFile.split("lease");

        // Remove extraneous lines (first three)
        for (let i = 0; i < 3; i++) {
          leaseFile.shift();
        }

        // Iterate through each lease
        for (let lease in leaseFile) {
          let mac_address;
          let hostname;

          // Split lease block into lines
          lease = leaseFile[lease].split('\n');

          // Iterate through each lease
          for (let line in lease) {
            // Find MAC address
            if (lease[line].includes(" hardware ethernet ")) {
              mac_address = lease[line].replace("  hardware ethernet ", "").replace(';', '');
            }

            // Find hostname
            if (lease[line].includes(" client-hostname ")) {
              hostname = lease[line].replace("  client-hostname ", "").replace(';', '').replace(/"/g, '');
            }
          }

          listFileHostnames.push({
            "mac_address": mac_address,
            "hostname": hostname
          });
        }

        // Iterate through parsed leases list
        for (let lease in listFileHostnames) {
          lease = listFileHostnames[lease];

          // Filter out undefined hostnames
          if (lease['hostname']) {
            // Create a canonical source of hostnames
            let mac_address = lease['mac_address'];
            let hostname = lease['hostname'];

            db.run("INSERT OR IGNORE INTO hostnames (mac_address, hostname) VALUES ('" + mac_address + "', '" + hostname + "')", function() {
              db.run("UPDATE hostnames SET hostname = '" + hostname + "' WHERE mac_address = '" + mac_address + "'");
            });
          }
        }
      });

      callback();
    },
    function(callback) {
      // 2: Get currently connected devices

      child.execFile('iw', ['dev', 'wlan0', 'station', 'dump'], function(err, stdout, stderr) {
        let connectedStations = stdout;

        // Parse through connected stations block
        connectedStations = connectedStations.split("Station");
        connectedStations.shift();

        for (let station in connectedStations) {
          station = connectedStations[station].split('\n')[0];
          station = station.split(' ')[1].replace(' ', '');
          listConnectedDevices.push(station);
        }

        callback();
      });
    },
    function(callback) {
      // 3: Check if each connected device is known to the router

      // Retreive all unblocked devices
      db.all("SELECT * FROM devices WHERE is_blocked='0'", function(err, rows) {
        if (rows.length > 0) {
          for (let row in rows) {
            let knownMacAddress = rows[row]['mac_address'];
            createNewDeviceNotifications();
          }
        } else {
          createNewDeviceNotifications();
        }
      });

      callback();
    },
    function(callback) {
      db.all("SELECT * FROM hostnames", function(err, rows) {

        for (let row in rows) {
          row = rows[row];
          listKnownHostnames.push(row);
        }

        callback();
      });
    },
    function(callback) {
      db.all("SELECT * FROM devices", function(err, rows) {

        for (let row in rows) {
          row = rows[row];
          listKnownDeviceInfo.push(row);
        }

        callback();
      });
    },
    function(callback) {
      // Send list of connected devices to UI

      for (let device in listConnectedDevices) {
        let mac_address = listConnectedDevices[device];
        let hostname = "[UNKNOWN]";
        let timestamp_connected = null;
        let type = null;
        let is_blocked = null;
        let snooze_period = null;

        // Find hostname
        for (let item in listKnownHostnames) {
          item = listKnownHostnames[item];

          if (item['mac_address'] === mac_address) {
            hostname = item['hostname'];
          }
        }

        // Find other information
        for (let item in listKnownDeviceInfo) {
          item = listKnownDeviceInfo[item];

          if (item['mac_address'] === mac_address) {
            timestamp_connected = item['timestamp_connected'];
            type = item['type'];
            is_blocked = item['is_blocked'];
            snooze_period = item['snooze_period'];
          }
        }

        listConnectedDevicesWithInfo.push({
          'mac_address': mac_address,
          'hostname': hostname,
          'timestamp_connected': timestamp_connected,
          'type': type,
          'is_blocked': is_blocked,
          'snooze_period': snooze_period
        });
      }

      callback();
    },
    function(callback) {
      // Get list of blocked devices
      db.all("SELECT * FROM devices WHERE is_blocked='1'", function(err, rows) {
        for (let row in rows) {
          row = rows[row];
          let hostname = "[UNKNOWN]";
          let type = row['type'];
          let mac_address = row['mac_address'];

          // Find hostname
          for (let item in listKnownHostnames) {
            item = listKnownHostnames[item];

            if (item['mac_address'] === mac_address) {
              hostname = item['hostname'];
            }
          }

          listBlockedDevices.push({
            'hostname': hostname,
            'type': type,
            'mac_address': mac_address
          });
        }

        callback();
      });
    },
    function() {
      io.sockets.emit('update_connected', listConnectedDevicesWithInfo);
      io.sockets.emit('update_blocked', listBlockedDevices);
    }
  ]);
}

function createNewDeviceNotifications() {
  // Iterate through each connected device
  for (let device in listConnectedDevices) {
    let thisDevice = listConnectedDevices[device];

    // Check if this device is known
    db.all("SELECT COUNT(*) FROM devices WHERE mac_address='" + thisDevice + "'", function(err, rows) {
      let result = rows[0]['COUNT(*)'];

      // If result is 0, then this is a new device
      if (parseInt(result) === 0) {
        db.all("SELECT * FROM hostnames WHERE mac_address='" + thisDevice + "'", function(err, rows) {
          let hostname = "";

          // Retrieve a hostname if possible
          if (rows.length > 0) {
            hostname = rows[0]['hostname'];
          } else {
            hostname = "[unknown]";
          }

          // Send notifications to the router UI
          io.sockets.emit('new_device', {
            "mac_address": thisDevice,
            "hostname": hostname
          });
        });
      }
    });
  }
}

function removeClient(mac_address) {
  // Append line to dhcpd.conf to prevent blocked MAC address
  // from getting a new IP address after disconnect
  fs.appendFile('/etc/dhcp/dhcpd.conf', 'host block-me { hardware ethernet ' + mac_address + '; deny booting; }\n', function() {
    child.execFile('service', ['isc-dhcp-server', 'restart'], function(err, stdout, stderr) {
      child.execFile('hostapd_cli', ['deauthenticate', mac_address], function(err, stdout, stderr) {
      });
    });
  });
}

// SERVER
http.listen(app.get('port'), function() {
  console.log("Server started on :" + app.get('port'));
});
