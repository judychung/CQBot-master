var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var client_io = require('socket.io-client');
var socket = client_io.connect('http://clearquest-ierp.w3ibm.mybluemix.net', {reconnect: true});
var cfenv = require('cfenv');

// Slack bot Variables
var Bot = require('slackbots');
var settings = {
  token: 'xoxb-57749050096-PuqLTSYEaldRJMkV1734FeYP',
  name: 'CQBot'
};
var botUserID = '<@U1PN11G2U>';
var startChannel = 'cq_bot_test';
var startMessage = 'CQBot is live!';
var icon = ':robot_face:';
var bot = new Bot(settings);

var message;
var tickURL;
var received = false;

// Initiates the bot and begins listening for messages
function runCQBot() {
  //Bot Start Method
  bot.on('start', function(){
    var params = {
      icon_emoji: icon,
      user_typing: true
    };
    bot.postMessageToChannel(startChannel, startMessage, params);
  });
}

bot.on('message', function(data) {
  var params = {
    icon_emoji: icon,
    user_typing: true
  };
  try {
    if(data != null) {
      if (data.text.startsWith(botUserID)) {
        console.log(data);

        processMessage(data.text, data.channel, data.user, params);
      }
    }
  }
  catch(err) {
    console.log(err.toString());
  }
});

function processMessage(message, channel, user, params) {
  received = false;
  message = message.slice(botUserID.length+2, message.length);

  console.log(message);

  if (message.startsWith('BHALM')) {
    bot.botTyping('C1P7V57D5');

    console.log('Detected a CQID call');
    cqTicket(message, channel, user, params);
  }

  // Invalid Command
  else {
    bot.postMessageToChannel(startChannel, "That was not a valid command. Please type a specific Ticket ID.", params);
  }
}

function cqTicket(message, channel, user, params) {
  console.log('here');

  console.log("client-io connected!");
  console.log('message1='+message);

  socket.emit('search', {"type":"search","auth":"Basic aWVycGJvdDpxMndxMndxMnc=","info":{"cq:id":{"=":message}}});
  console.log("id emited to cq");

  socket.on('results', function (data) {
    console.log('here');
    console.log('received='+received);
    console.log('message='+message);

    if (received == false) {
      var json = JSON.stringify(data);
      console.log("json=" + json);
      var split = json.split('records":{');
      var idURL = split[1];
      console.log(split[1]);
      var untrimmedTickURL = idURL.split(/:(.+)?/)[1];

      if (untrimmedTickURL != null) {
        bot.botTyping('C1P7V57D5');

        tickURL = untrimmedTickURL.substring(1, untrimmedTickURL.length-3);
        console.log("tickURL="+tickURL);

        socket.emit('search_one', {"type": "search_one", "id":message, "auth":"Basic aWVycGJvdDpxMndxMndxMnc=","url":tickURL});
        socket.removeAllListeners('results');
      }
      else {
        bot.postMessageToChannel(startChannel, "The ticket " + message + " was not found on the server. Enter another Ticket ID.", params);
        socket.removeAllListeners('results');
      }
      socket.removeAllListeners('results');
    }
    socket.removeAllListeners('results');
  });

  socket.on('search_one_results', function (data) {
    var output = "Ticket ID: " + data['content']['oslc:shortTitle']
                  + "\nStatus: " + data['content']['oslc_cm:status']
                  + "\nCreator Name: " + data['content']['cq:CreatorName']
                  + "\nCreation Date: " + data['content']['cq:CreationDate']
                  + "\nSummary: " + data['content']['dcterms:title']
                  + "\nOwner Name: " + data['content']['cq:OwnerName']
                  + "\nReported Severity: " + data['content']['cq:ReportedSeverity']
                  + "\nInternal Severity: " + data['content']['cq:InternalSeverity']
                  + "\nOwner Group: " + data['content']['cq:OwnerGroup']
                  + "\nImpacted Domain: " + data['content']['cq:ImpactedDomain']
                  + "\nImpacted Subprocess: " + data['content']['cq:ImpactedSubProcess']
                  + "\nTarget Finish Date: " + data['content']['cq:TargetFinishDate']
                  + "\nAdjusted Target Date: " + data['content']['cq:AdjustedTargetDate']
                  + "\nActual Finish Date: " + data['content']['cq:ActualFinishDate']
                  + "\nTicket URL: " + tickURL;
    if (received == false) {
      bot.postMessageToChannel(startChannel, output, params);
      socket.removeAllListeners('search_one_results');
      received = true;
    }
    socket.removeAllListeners('search_one_results');
  });
}

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
http.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
  console.log("Starting CQBot");
  runCQBot();
});

/**
* Sends an event like Bot is typing to other clients
* @param {string} id - channel ID
*/
Bot.prototype.botTyping = function(channelId) {
  return this.ws.send(JSON.stringify({ type: 'typing', channel: channelId }));
};
