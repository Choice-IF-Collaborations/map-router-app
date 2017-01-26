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
  socket.on('update_response', function(data) {
    updateDevices(data);
    lastUpdatedSecs = 0;
  });

  // EVENTS
  // Refresh button
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

  // FUNCTIONS
  function updateDevices(data) {
    $('#device_list ul').empty();
    $('#refresh_button').text("Refreshing...");

    for (let device in data) {
      device = data[device];

      if (device.is_blocked === 0) {
        $('#device_list ul').append("<li>" + device.hostname + "</li>")
      }
    }

    $('#refresh_button').text("Refresh");
  }

  function createNotification(data) {
    if (notifications.indexOf(data.mac_address) == -1) {
      notifications.push(data.mac_address);

      notificationCounter++;

      let $notificationTemplate = $('#notification_template').clone();
      $notificationTemplate.attr('id', 'notification_' + notificationCounter);
      $notificationTemplate.find('.device_name').text(data.hostname);
      $notificationTemplate.find('.ignore_device').attr('data-mac-address', data.mac_address);
      $notificationTemplate.find('.remove_device').attr('data-mac-address', data.mac_address);
      $notificationTemplate.css({ 'display': 'flex' });

      $('#notifications').append($notificationTemplate);
    }
  }
});
