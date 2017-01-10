# CHOICE Map Router

## What is this?
This is a Node.js app that shows what devices are connected to a Rasberry Pi-based router by their hostname.

It also:
* Creates a new Wi-Fi access point and can bridge an Internet connection from an existing router.

* Shows notifications when a device that hasn't been seen before is connected to the router.

* Gives people the option to block a new device from connecting to the router.

## Requirements

### Hardware

* Raspberry Pi 2 B+
* microSD card
* Compatible Wi-Fi adaptor (tested with )
* Screen for Raspberry Pi
* External power supply
* Ethernet cable
* Router/modem with Ethernet

### Software

* Raspbian (tested with)
* Node.js v6.9.4
* Chromium browser

## Installation

### Prepare Raspberry Pi

1. Install the screen,

2. Copy Raspbian to a microSD card.

3. Boot up and run `sudo raspi-config` to expand the filesystem, change the hostname to something like `choice-router` and change the default passport. Reboot.

4. Install latest updates with `sudo apt-get update && sudo apt-get upgrade -y`.

### Create Wi-Fi access point

1. Install dependencies with `sudo apt-get install hostapd isc-dhcp-server chromium-browser netatalk iptables-persistent`. **Note**: `iptables-persistent` will prompt you twice, answer "Yes".

2. Run `sudo nano /etc/dhcp/dhcpd.conf`.

3. Comment out these lines:
```
option domain-name "example.org";
option domain-name-servers ns1.example.org, ns2.example.org;
```

4. Uncomment this word:
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

6. Save this file and exit.

7. Run `sudo nano /etc/default/isc-dhcp-server`.

8. Find `INTERFACES=""` and change it to `INTERFACES="wlan0"`. Save this file and exit.

9. Run `sudo ifdown wlan0` to turn off the Wi-Fi adaptor.

10. Run `sudo nano /etc/network/interfaces`.

11. Replace the entire file with the following:
  ```
  auto lo

  iface lo inet loopback
  iface eth0 inet dhcp

  allow-hotplug wlan0
  iface wlan0 inet static
      address 192.168.42.1
      netmask 255.255.255.0
  ```

12. Save and close.

13. Run `sudo ifconfig wlan0 192.168.42.1`.

14. Run `sudo nano /etc/hostapd/hostapd.conf`.

15. Paste the following into the file. Change `wpa_passphrase=XXXXXX` to something else.

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

16. Run `sudo nano /etc/default/hostapd`

17. Change `#DAEMON_CONF=""` to `DAEMON_CONF="/etc/hostapd/hostapd.conf"`.

18. Save and exit.

19. Run `sudo nano /etc/init.d/hostapd`.

20. Change `DAEMON_CONF=` to `DAEMON_CONF=/etc/hostapd/hostapd.conf`

21. Save and exit.

22. Run `sudo nano /etc/sysctl.conf`

23. At the bottom of the file add `net.ipv4.ip_forward=1`.

23. Save and exit.

24. Run the following commands:

  ```
  sudo sh -c "echo 1 > /proc/sys/net/ipv4/ip_forward"
  sudo iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
  sudo iptables -A FORWARD -i eth0 -o wlan0 -m state --state RELATED,ESTABLISHED -j ACCEPT
  sudo iptables -A FORWARD -i wlan0 -o eth0 -j ACCEPT
  sudo sh -c "iptables-save > /etc/iptables/rules.v4"

  ```

25. Run `sudo /usr/sbin/hostapd /etc/hostapd/hostapd.conf` and check if the Wi-Fi access point has started. Press `CTRL + C` to exit this test.

26. Run the following commands:
```
sudo service hostapd start
sudo service isc-dhcp-server start
sudo update-rc.d hostapd enable
sudo update-rc.d isc-dhcp-server enable
```

### Install Node.js

1. Download Node.js with `wget https://nodejs.org/dist/v6.9.4/node-v6.9.4-linux-armv7l.tar.gz`.
2. Extract it with `tar -xvf node-v6.9.4-linux-armv7l.tar.gz`.
3. Move into the extracted folder with `cd node-v6.9.4-linux-armv7l`.
4. Install Node.js with `sudo cp -R * /usr/local/`.
5. Test the installation by running `node -v && npm -v`.

### Install this app

1. Clone this repository with `git clone `
2. Run `npm install` to download it's dependencies.
3. Run `touch known.txt blacklist.txt` to create blank database files.


## Usage

* The Wi-Fi access point should be immediately usable.

* The app is started by running `sudo node index.js` inside the repository. It must be run as `sudo` to do blocking.

* The interface can be accessed in Chromium Browser at `http://localhost:3000`.

## References

* https://learn.adafruit.com/setting-up-a-raspberry-pi-as-a-wifi-access-point/install-software
