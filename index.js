"use strict";

// REQUIRES
var express = require('express');
var path = require('path');
var app = express();
var http = require('http').Server(app);
var child = require('child_process');

// RUNTIME VARIABLES
let dhcp_devices = [];
let connected_devices = [];
let matched_connected_devices = [];

// CONFIG
app.set('port', process.env.PORT || 3000);
app.set('view engine', 'jade');
app.use('/public', express.static(path.join(__dirname, 'public')));

// ROUTES
// Render the app view
app.get('/', function(req, res) {
  res.render('index');
});

app.get('/latest', function(req, res) {
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

      if (typeof hostname !== "undefined") {
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


      res.json(matched_connected_devices);
    });
  });
});

// SERVER
http.listen(app.get('port'), function() {
	console.log("Server started on :" + app.get('port'));
});

function getConnectedDevices() {

}
