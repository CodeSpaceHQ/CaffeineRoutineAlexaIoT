//Environment Configuration

var config = {};

config.IOT_BROKER_ENDPOINT      = "YOUR_IOT_ENDPOINT.amazonaws.com".toLowerCase();
config.IOT_BROKER_REGION        = "YOUR_REGION";
config.IOT_THING_NAME           = "YOUR_IOT_THING_NAME";
config.params                   = { thingName: 'YOUR_IOT_THING_NAME' };
//Loading AWS SDK libraries

var Alexa = require('alexa-sdk');
var AWS = require('aws-sdk');
AWS.config.region = config.IOT_BROKER_REGION;

//Initializing client for IoT
var iotData = new AWS.IotData({endpoint: config.IOT_BROKER_ENDPOINT});
var SKILL_NAME = 'YOUR_SKILL_NAME';

exports.handler = function (event, context) {
    try {
        console.log("event.session.application.applicationId=" + event.session.application.applicationId);

        if (event.session.application.applicationId !== "APPLICATION_ID") {
             context.fail("Invalid Application ID");
        }

        if (event.session.new) {
            onSessionStarted({requestId: event.request.requestId}, event.session);
        }

        if (event.request.type === "LaunchRequest") {
            onLaunch(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "IntentRequest") {
            onIntent(event.request,
                event.session,
                function callback(sessionAttributes, speechletResponse) {
                    context.succeed(buildResponse(sessionAttributes, speechletResponse));
                });
        } else if (event.request.type === "SessionEndedRequest") {
            onSessionEnded(event.request, event.session);
            context.succeed();
        }
    } catch (e) {
        context.fail("Exception: " + e);
    }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +", sessionId=" + session.sessionId);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId + ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId + ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent,
        intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    if ("BrewIntent" === intentName) {
        brewNow(intent, session, callback);
    } else if ("CancelBrewIntent" === intentName) {
        stopBrewing(intent, session, callback);
    } else if ("AMAZON.HelpIntent" === intentName) {
        getHelp(callback);
    } else if ("AMAZON.StopIntent" === intentName || "AMAZON.CancelIntent" === intentName) {
        handleSessionEndRequest(callback);
    } else {
        throw "Invalid intent";
    }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
        ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback, status) {
    var sessionAttributes = {};
    var cardTitle = "Welcome";
    var speechOutput = "Welcome to Caffeine Routine, where we help you get the cofee you need.";
    var repromptText = "Would you like to make coffe?";
    var shouldEndSession = false;

    brewStatus = getBrewStatus();

    if (brewStatus == 1) {
        speechOutput = "Welcome to Caffeine Routine, water is currently heating.";
        repromptText = "Would you like to cancel?";
    } else if (brewStatus == 2) {
        speechOutput = "Welcome to Caffeine Routine, water has been heated.";
        repromptText = "Would you like to make coffee?";
    } else if (brewStatus == 3) {
        speechOutput = "Welcome to Caffeine Routine, coffee is currently brewing.";
        repromptText = "Would you like to cancel?";
    }

    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getHelp(callback) {
    var cardTitle = "Help";
    var speechOutput = "Welcome to Caffeine Routine, you can ask me to make coffee.";
    var repromptText = "Would you like coffee?";
    var shouldEndSession = false;

    callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function handleSessionEndRequest(callback) {
    var cardTitle = "Session Ended";
    var speechOutput = "Have a great day!";
    var shouldEndSession = true;
    callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession));
}

function getBrewStatus() {
   var cardTitle = "BrewStats";
   var repromptText = "";
   var sessionAttributes = {};
   var shouldEndSession = true;
   var brewStatus = 0;

   var statusMessage = "";

   iotData.getThingShadow(config.params, function(err, data) {
      if (err)  {
           console.log(err, err.stack); // an error occurred
      } else {
           //console.log(data.payload);           // successful response
           payload = JSON.parse(data.payload);
           brewStatus = payload.state.reported.hardwareStatus;
      }
   });

   return brewStatus;
}

function brewNow(intent, session, callback) {
   var cardTitle = "BrewNow";
   var repromptText = "";
   var sessionAttributes = {};
   var shouldEndSession = true;

   /*
     * Update AWS IoT
    */
    var payloadObj={ "state": { "desired": { "brewStatus": 1 } } };

    //Prepare the parameters of the update call
    var paramsUpdate = {

      "thingName" : config.IOT_THING_NAME,
      "payload" : JSON.stringify(payloadObj)

    };

    // Update IoT Device Shadow
    iotData.updateThingShadow(paramsUpdate, function(err, data) {

      if (err){
        console.log(err); // Handle any errors
        statusMessage = "error error";
      }
      else {
        console.log(data);
        statusMessage = "has started brewing coffee";
      }

      speechOutput = "Caffeine Routine " + statusMessage;
      callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    });
}

function stopBrewing(intent, session, callback) {
   var cardTitle = "BrewNow";
   var repromptText = "";
   var sessionAttributes = {};
   var shouldEndSession = true;

   /*
     * Update AWS IoT
    */
    var payloadObj={ "state": { "desired": { "brewStatus": 0 } } };

    //Prepare the parameters of the update call
    var paramsUpdate = {

      "thingName" : config.IOT_THING_NAME,
      "payload" : JSON.stringify(payloadObj)

    };

    // Update IoT Device Shadow
    iotData.updateThingShadow(paramsUpdate, function(err, data) {

      if (err){
        console.log(err); // Handle any errors
        statusMessage = "error error";
      }
      else {
        console.log(data);
        statusMessage = "has stopped brewing coffee";
      }

      speechOutput = "Caffeine Routine " + statusMessage;
      callback(sessionAttributes, buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
    });
}

// --------------- Helpers that build all of the responses -----------------------
function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
    return {
        outputSpeech: {
            type: "PlainText",
            text: output
        },
        card: {
            type: "Simple",
            title: title,
            content: output
        },
        reprompt: {
            outputSpeech: {
                type: "PlainText",
                text: repromptText
            }
        },
        shouldEndSession: shouldEndSession
    };
}

function buildResponse(sessionAttributes, speechletResponse) {
    return {
        version: "1.0",
        sessionAttributes: sessionAttributes,
        response: speechletResponse
    };
}
