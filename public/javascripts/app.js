$(window).load(function() {
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
});
