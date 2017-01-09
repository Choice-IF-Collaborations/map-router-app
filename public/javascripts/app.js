$(window).load(function() {
  let notificationCounter = 0;

  // Runtime variables
  //var socket = io();

  // Receive payload of new information
  //socket.on('payload', function (data) {

  //});

  updateNetworks();

  $('#refresh_button').click(function(e) {
    e.preventDefault();
    updateNetworks();
  });

  function updateNetworks() {
    $('#device_list ul').empty();
    $('#refresh_button').text("Refreshing...");

    $.getJSON("/latest", function(data) {
      for (let network in data) {
        let hostname = data[network]["hostname"];
        $('#device_list ul').append("<li>" + hostname + "</li>")
      }

      $('#refresh_button').text("Refresh");
    });
  }

  setInterval(function() {
    updateNetworks();
  }, 5000);

  function createNotification(deviceName) {
    notificationCounter++;

    let $notificationTemplate = $('#notification_template').clone();
    $notificationTemplate.attr('id', 'notification_' + notificationCounter);
    $notificationTemplate.find('.device_name').text(deviceName);
    $notificationTemplate.css({ 'display': 'flex' });
    $('#notifications').append($notificationTemplate);
  }

  $('body').on('click', '.remove_device', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent();

    $parent.fadeOut(250, function() {
      $parent.remove();
    });
  });

  $('body').on('click', '.ignore_device', function(e) {
    e.preventDefault();

    let $parent = $(this).parent().parent().parent().parent();

    $parent.fadeOut(250, function() {
      $parent.remove();
    });
  });
});
