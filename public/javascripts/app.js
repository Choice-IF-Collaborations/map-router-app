$(window).load(function() {
  // Runtime variables
  var socket = io();
  let notificationCounter = 0;
  let notifications = [];
  let lastUpdatedSecs = 0;

  // START
  // Fetch information when page first loaded
  socket.emit('update_call', null);

  setInterval(function() {
    lastUpdatedSecs++;

    if (lastUpdatedSecs === 1) {
      $('#last_updated_num').text(lastUpdatedSecs + " second");
    } else {
      $('#last_updated_num').text(lastUpdatedSecs + " seconds");
    }
  }, 1000);

  // Poll for new information
  setInterval(function() {
    socket.emit('update_call', null);
  }, 5000);

  // SOCKET.IO
  // Receive new device notifications and draw them
  socket.on('new_device', function (data) {
    createNotification(data);
  });

  // Receive new device information and display it
  socket.on('update_connected', function(data) {
    updateConnectedDevices(data);
    lastUpdatedSecs = 0;
  });

  socket.on('update_blocked', function(data) {
    updateBlockedDevices(data);
  });

  // EVENTS
  // Refresh button
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
      $('#router_information').show();
      $('#router_info_link').addClass('active');
    }
  });

  $('#refresh_button').click(function(e) {
    e.preventDefault();
    socket.emit('update_call', null);
  });

  // Remove device
  $('body').on('click', '.remove_device', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent();

    $.ajax({
      type: "POST",
      url: "/remove",
      data: {
        mac_address: $(this).attr('data-mac-address'),
        type: $parent.attr('data-type')
      },
      success: function() {
        $parent.fadeOut(250, function() {
          $parent.remove();
        });
      }
    });
  });

  // Ignore device
  $('body').on('click', '.ignore_device', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent();

    $.ajax({
      type: "POST",
      url: "/ignore",
      data: {
        mac_address: $(this).attr('data-mac-address'),
        type: $parent.attr('data-type')
      },
      success: function() {
        $parent.fadeOut(250, function() {
          $parent.remove();
        });
      }
    });
  });

  $('body').on('click', '.choose_icon', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent();

    $parent.find('.choose_icon_view').fadeIn(250);

  });

  $('body').on('click', '.choose_icon_view .icons a', function(e) {
    e.preventDefault();

    let type = $(this).text().toLowerCase();
    let $notification = $(this).parent().parent().parent();

    // Update UI
    $(this).parent().find('a').removeClass('selected');
    $(this).addClass('selected');

    // Append device type to notification
    $notification.attr('data-type', type)
  });

  $('body').on('click', '.choose_icon_view .close_icon_view', function(e) {
    e.preventDefault();

    $notification = $(this).parent().parent();
    let type = $notification.attr('data-type');

    if (type !== "unknown") {
      $notification.find('.choose_icon_view').fadeOut(250);
    } else {
      return
    }
  });

  $('body').on('click', '.snooze_choices a', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent()
    let mac_address = $parent.attr('data-mac-address');
    let snooze_period = $(this).attr('data-snooze-period');

    $.ajax({
      type: "POST",
      url: "/snooze",
      data: {
        mac_address: mac_address,
        type: $parent.attr('data-type'),
        snooze_period: snooze_period
      },
      success: function() {
        $parent.fadeOut(250, function() {
          $parent.remove();
        });
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
        $('#connected_devices_list').append('<div class="device ' + device.type + '">' + device.hostname + "</div>");
      }
    }

    $('#refresh_button').text("Refresh");
  }

  function updateBlockedDevices(data) {
    $('#blocked_devices_list').empty();

    for (let device in data) {
      device = data[device];

      $('#blocked_devices_list').append('<div class="device ' + device.type + '" data-mac-address="' + device.mac_address + '"><a href="#">' + device.hostname + "</a></div>");
    }
  }

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
