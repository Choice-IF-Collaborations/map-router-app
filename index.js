"use strict";

// REQUIRES
var express = require('express');
var path = require('path');
var app = express();
var http = require('http').Server(app);
var child = require('child_process');
var io = require('socket.io')(http);
var fs = require('fs');
var bodyParser = require('body-parser')

// RUNTIME VARIABLES
let dhcp_devices = [];
let connected_devices = [];
let matched_connected_devices = [];

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

  fs.appendFile('known.txt', ';' + mac_address);

  res.sendStatus(200);
});

app.post('/ignore', function(req, res) {
  let mac_address = req.body.mac_address;

  fs.appendFile('known.txt', ';' + mac_address);

  res.sendStatus(200);
});

// SOCKET.IO
// When the UI asked for an update, respond
io.on('connection', function (socket) {
  socket.on('update_call', function (data) {
    update();
  });
});

function update() {
  dhcp_devices = [];
  connected_devices = [];
  matched_connected_devices = [];

  child.execFile('cat', ['/var/lib/dhcp/dhcpd.leases'], function(err, stdout, stderr) {
    let leaseFile = stdout;

    leaseFile = leaseFile.split("lease");

    // Remove extraneous lines (first three)
    for (let i = 0; i < 3; i++) {
      leaseFile.shift();
    }

    for (let lease in leaseFile) {
      let mac_address;
      let hostname;

      lease = leaseFile[lease].split('\n');

      for (let line in lease) {
        if (lease[line].includes(" hardware ethernet ")) {
          mac_address = lease[line].replace("  hardware ethernet ", "").replace(';', '');
        }

        if (lease[line].includes(" client-hostname ")) {
          hostname = lease[line].replace("  client-hostname ", "").replace(';', '').replace(/"/g, '');
        }
      }

      if (typeof hostname != "undefined") {
        dhcp_devices.push({
          "mac_address": mac_address,
          "hostname": hostname
        });
      }
    }

    child.execFile('iw', ['dev', 'wlan0', 'station', 'dump'], function(err, stdout, stderr) {
      let connectedStations = stdout;

      connectedStations = connectedStations.split("Station");

      connectedStations.shift();

      for (let station in connectedStations) {
        station = connectedStations[station].split('\n')[0];
        station = station.split(' ')[1].replace(' ', '');
        connected_devices.push(station);
      }

      for (let device in connected_devices) {
        let mac_address = connected_devices[device];
        let hostname;

        for (let dhcp_device in dhcp_devices) {
          if (dhcp_devices[dhcp_device]["mac_address"] === mac_address) {
            hostname = dhcp_devices[dhcp_device]["hostname"];
          }
        }

        matched_connected_devices.push({
          "mac_address": mac_address,
          "hostname": hostname
        });
      }

      fs.readFile('known.txt', 'utf8', function (err, data) {
        // Split known mac address into array
        let knownMacAddresses = data.split(';')

        for (let device in matched_connected_devices) {
          let newDevice = matched_connected_devices[device]['mac_address'];
          let match = false;

          for (let address in knownMacAddresses) {
            let knownDevice = knownMacAddresses[address];

            if (newDevice === knownDevice) {
              match = true;
            }
          }

          if (!match) {
            io.sockets.emit('new_device', matched_connected_devices[device]);
          }
        }
      });

      io.sockets.emit('update_response', matched_connected_devices);
    });
  });
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
