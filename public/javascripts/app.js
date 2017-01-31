$(window).load(function() {
  // Runtime variables
  var socket = io();
  let notificationCounter = 0;
  let notifications = [];
  let lastUpdatedSecs = 0;

  // START
  // Fetch information when page first loaded
  socket.emit('update_call', null);

  // Poll for new information
  setInterval(function() {
    socket.emit('update_call', null);
  }, 5000);

  // Update last updated counter
  setInterval(function() {
    lastUpdatedSecs++;

    if (lastUpdatedSecs === 1) {
      $('#last_updated_num').text(lastUpdatedSecs + " second");
    } else {
      $('#last_updated_num').text(lastUpdatedSecs + " seconds");
    }
  }, 1000);

  // SOCKET.IO
  // Receive new device notifications and draw them
  // Create notification for new device
  socket.on('new_device', function (data) {
    createNotification(data);
  });

  // Update list of connected devices
  socket.on('update_connected', function(data) {
    updateConnectedDevices(data);
    lastUpdatedSecs = 0;
  });

  // Update list of blocked devices
  socket.on('update_blocked', function(data) {
    updateBlockedDevices(data);
  });

  // EVENTS
  // Navigation
  $('#nav a').click(function(e) {
    e.preventDefault();

    let target = $(this).attr('id');

    $(this).parent().children().removeClass('active');

    $('.view').hide();

    if (target === "blocked_devices_link") {
      $('#blocked_devices').show();
      $('#blocked_devices_link').addClass('active');
    } else if (target === "connected_devices_link") {
      $('#connected_devices').show();
      $('#connected_devices_link').addClass('active');
    } else if (target === "router_info_link") {
      $('#router_information').css({
        'justify-content': 'center',
        'align-items': 'center',
        'display': 'flex'
      });

      $('#router_info_link').addClass('active');
    }
  });

  // Block device
  $('body').on('click', '.remove_device', function(e) {
    e.preventDefault();

    let $notification = $(this).parent().parent().parent().parent().parent();

    $.ajax({
      type: "POST",
      url: "/remove",
      data: {
        mac_address: $(this).attr('data-mac-address'),
        type: $notification.attr('data-type')
      },
      success: function() {
        $notification.fadeOut(250, function() {
          $notification.remove();
        });
      }
    });
  });

  // Ignore device
  $('body').on('click', '.ignore_device', function(e) {
    e.preventDefault();

    let $notification = $(this).parent().parent().parent().parent().parent();

    $notification.attr('data-action', 'ignore');

    $notification.find('.options_view').fadeOut(250, function() {
      $notification.find('.icons_view').fadeIn();
    });
  });

  // Snooze device
  $('body').on('click', '.snooze_device', function(e) {
    e.preventDefault();

    let $notification = $(this).parent().parent().parent().parent().parent();;

    $notification.attr('data-action', 'snooze');

    $notification.find('.options_view .options').fadeOut(250, function() {
      $notification.find('.options_view .snooze_choices').fadeIn(250);
    });
  });

  // Select snooze period
  $('body').on('click', '.snooze_choices a', function(e) {
    e.preventDefault();

    let $notification = $(this).parent().parent().parent().parent().parent();
    let mac_address = $notification.attr('data-mac-address');
    let snooze_period = $(this).attr('data-snooze-period');

    $notification.attr('data-snooze-period', snooze_period);

    $notification.find('.options_view').fadeOut(250, function() {
      $notification.find('.icons_view').fadeIn();
    });
  });

  // Choose icon
  $('body').on('click', '.icons_view .icons a', function(e) {
    e.preventDefault();

    let type = $(this).text().toLowerCase();
    let $notification = $(this).parent().parent().parent().parent().parent();

    // Update UI
    $(this).parent().find('a').removeClass('selected');
    $(this).addClass('selected');

    // Append device type to notification
    $notification.attr('data-type', type);
  });

  // Dismiss notification after choosing icon
  $('body').on('click', '.notification_done', function(e) {
    e.preventDefault();

    let $notification = $(this).parent().parent().parent().parent().parent();
    let action = $notification.attr('data-action');

    if (action === "ignore") {
      $.ajax({
        type: "POST",
        url: "/ignore",
        data: {
          mac_address: $notification.attr('data-mac-address'),
          type: $notification.attr('data-type')
        },
        success: function() {
          $notification.fadeOut(250, function() {
            $notification.remove();
          });
        }
      });
    } else if (action === "snooze") {
      $.ajax({
        type: "POST",
        url: "/snooze",
        data: {
          mac_address: $notification.attr('data-mac-address'),
          type: $notification.attr('data-type'),
          snooze_period: $notification.attr('data-snooze-period')
        },
        success: function() {
          $notification.fadeOut(250, function() {
            $notification.remove();
          });
        }
      });
    }
  });

  // Unblock device
  $('body').on('click', '#blocked_devices_list .device a', function(e) {
    e.preventDefault();

    let device_icon = $(this).parent();
    let mac_address = $(this).parent().attr('data-mac-address');

    $.ajax({
      type: "POST",
      url: "/unremove",
      data: {
        mac_address: mac_address
      },
      success: function() {
        device_icon.remove();
      }
    });
  });

  // FUNCTIONS
  function updateConnectedDevices(data) {
    $('#refresh_button').text("Refreshing...");

    // Update list of connected devices
    $('#connected_devices_list').empty();

    for (let device in data) {
      device = data[device];

      if (device.is_blocked === 0) {
        if (device.hostname === "A device") {
          device.hostname = device.type.charAt(0).toUpperCase() + device.type.slice(1);
        }

        $('#connected_devices_list').append('<div class="device ' + device.type + '">' + device.hostname + "</div>");
      }
    }

    $('#refresh_button').text("Refresh");
  }

  function updateBlockedDevices(data) {
    $('#blocked_devices_list').empty();

    for (let device in data) {
      device = data[device];

      if (device.hostname === "A device") {
        device.hostname = device.type.charAt(0).toUpperCase() + device.type.slice(1);
      }

      $('#blocked_devices_list').append('<div class="device ' + device.type + '" data-mac-address="' + device.mac_address + '"><a href="#">' + device.hostname + "</a></div>");
    }
  }

  function createNotification(data) {
    if (notifications.indexOf(data.mac_address) == -1) {
      notifications.push(data.mac_address);

      notificationCounter++;

      let $notificationTemplate = $('#notification_template').clone();
      $notificationTemplate.attr('id', 'notification_' + notificationCounter);
      $notificationTemplate.attr('data-mac-address', data.mac_address);
      $notificationTemplate.find('.device_name').text(data.hostname);
      $notificationTemplate.find('.ignore_device').attr('data-mac-address', data.mac_address);
      $notificationTemplate.find('.remove_device').attr('data-mac-address', data.mac_address);
      $notificationTemplate.css({ 'display': 'flex' });

      $('#notifications').append($notificationTemplate);
    }
  }
});
