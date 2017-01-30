# CHOICE Map Router

## What is this?
This is a Node.js app that shows what devices are connected to a Raspberry Pi-based router by their hostname.

It also:

* Creates a new Wi-Fi access point and can bridge an Internet connection from an existing router or modem.
* Shows a notification when a device that hasn't been seen before connects to the router.
* Provides the option to block a new device from connecting to the router, immediately or after some time has passed.
* Persists what devices have been seen and what has been blocked between sessions.
* Allows an icon to be assigned to a device to help people identify them.

## Requirements

### Hardware

* Raspberry Pi 2 B+
* microSD card
* Compatible USB Wi-Fi adaptor (tested with [TP-LINK TL-WN823N](https://www.amazon.co.uk/TP-LINK-TL-WN823N-Mbps-Wireless-Adapter/dp/B0088TKTY2))
* [Screen for Raspberry Pi](https://www.modmypi.com/raspberry-pi/screens-and-displays/raspberry-pi-7-touchscreen-display-official)
* External power supply
* Ethernet cable
* Router/modem with Internet access

### Software

* Raspbian with Pixel (tested with version 2016-11-25, [Download ZIP](https://downloads.raspberrypi.org/raspbian_latest))
* Node.js v6.9.4
* Chromium

## Installation

### Prepare Raspberry Pi

1. Install the screen.
2. Copy Raspbian to a microSD card, insert into the Raspberry Pi and power on.
3. Configure the orientation of the touch screen by running `sudo nano /boot/config.txt` and appending `lcd_rotate=2`. Reboot.
4. Run `sudo raspi-config` to expand the filesystem, enable SSH and change the hostname to something like `choice-router`. Reboot.
5. Run `passwd` to change the default password.
6. Install latest updates with `sudo apt-get update && sudo apt-get upgrade -y`. Reboot.
7. If required, install drivers for the USB Wi-Fi adaptor. The TP-LINK TL-WN823N was installed with these commands:

  ```
  wget https://dl.dropboxusercontent.com/u/80256631/install-wifi.tar.gz
  tar xzf install-wifi.tar.gz
  sudo ./install-wifi
  sudo reboot
  ```

### Create Wi-Fi access point

1. Install dependencies with `sudo apt-get install hostapd isc-dhcp-server netatalk iptables-persistent -y`.
  **Note**: `iptables-persistent` will prompt you twice. Answer "Yes" each time.
2. Run `sudo nano /etc/dhcp/dhcpd.conf`.
3. Comment out these lines:

  ```
  option domain-name "example.org";
  option domain-name-servers ns1.example.org, ns2.example.org;
  ```
4. Uncomment this line:

  ```
  authoritative;
  ```
5. Add these lines to the bottom of the file:

  ```
  subnet 192.168.42.0 netmask 255.255.255.0 {
      range 192.168.42.10 192.168.42.50;
      option broadcast-address 192.168.42.255;
      option routers 192.168.42.1;
      default-lease-time 600;
      max-lease-time 7200;
      option domain-name "local";
      option domain-name-servers 8.8.8.8, 8.8.4.4;
  }
  ```
6. Save and exit.
7. Run `sudo nano /etc/default/isc-dhcp-server`.
8. Find `INTERFACES=""` and change it to `INTERFACES="wlan0"`.
9. Save this file and exit.
10. Run `sudo ifdown wlan0` to turn off the Wi-Fi adaptor.
11. Run `sudo nano /etc/network/interfaces`.
12. Replace the entire file with the following:

  ```
  auto lo

  iface lo inet loopback
  iface eth0 inet dhcp

  allow-hotplug wlan0
  iface wlan0 inet static
      address 192.168.42.1
      netmask 255.255.255.0
  ```
13. Save and exit.
14. Run `sudo ifconfig wlan0 192.168.42.1`.
15. Run `sudo nano /etc/hostapd/hostapd.conf`.
16. Paste the following into the file. Change `wpa_passphrase=XXXXXX` to something else.

  ```
  interface=wlan0
  ssid=CHOICE-Router
  country_code=US
  hw_mode=g
  channel=6
  macaddr_acl=0
  auth_algs=1
  ignore_broadcast_ssid=0
  wpa=2
  wpa_passphrase=XXXXXX
  wpa_key_mgmt=WPA-PSK
  wpa_pairwise=CCMP
  wpa_group_rekey=86400
  ieee80211n=1
  wme_enabled=1
  ctrl_interface=/var/run/hostapd
  ```
17. Save and exit.
18. Run `sudo nano /etc/default/hostapd`.
19. Change `#DAEMON_CONF=""` to `DAEMON_CONF="/etc/hostapd/hostapd.conf"`.
20. Save and exit.
21. Run `sudo nano /etc/init.d/hostapd`.
22. Change `DAEMON_CONF=` to `DAEMON_CONF=/etc/hostapd/hostapd.conf`
23. Save and exit.
24. Run `sudo nano /etc/sysctl.conf`.
25. At the bottom of the file add `net.ipv4.ip_forward=1`.
26. Save and exit.
27. Run the following commands:

  ```
  sudo sh -c "echo 1 > /proc/sys/net/ipv4/ip_forward"
  sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
  sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
  sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
  sudo sh -c "iptables-save > /etc/iptables/rules.v4"
  ```
28. Run `sudo /usr/sbin/hostapd /etc/hostapd/hostapd.conf` and check if the Wi-Fi access point has started. Press `CTRL + C` to exit this test.
29. Run the following commands:

  ```
  sudo service hostapd start
  sudo service isc-dhcp-server start
  sudo update-rc.d hostapd enable
  sudo update-rc.d isc-dhcp-server enable
  ```
30. Reboot.

### Install Node.js

1. Download Node.js with `wget https://nodejs.org/dist/v6.9.4/node-v6.9.4-linux-armv7l.tar.gz`.
2. Extract it with `tar -xvf node-v6.9.4-linux-armv7l.tar.gz`.
3. Move into the extracted folder with `cd node-v6.9.4-linux-armv7l`.
4. Install Node.js with `sudo cp -R * /usr/local/`.
5. Test the installation by running `node -v && npm -v`.

### Install this app

1. Clone this repository with `git clone https://github.com/Choice-IF-Collaborations/map-router-app.git`.
2. Move into the repository folder with `cd map-router-app`.
3. Run `npm install` to download it's dependencies.
4. Run `cp router.db.empty router.db` to create a blank database file.

## Usage

* The Wi-Fi access point should be immediately usable.
* The app is started by running `sudo node index.js` inside the repository. It must be run as `sudo` allow device blocking to work.
* The interface can be accessed in Chromium at `http://localhost:3000`.
* The database file can be reset by running `cp router.db.empty router.db` again and can be edited on macOS with [DB Browser for SQLite](http://sqlitebrowser.org).
* This file changes `/etc/dhcp/dhcpd.conf` to block devices and reads `/var/lib/dhcp/dhcpd.leases` to get hostnames.

## References

* Wi-Fi access point instructions adapted from [this tutorial on Adafruit](https://learn.adafruit.com/setting-up-a-raspberry-pi-as-a-wifi-access-point/install-software).
