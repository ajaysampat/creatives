var http = require('http');
var url = require('url');
var request = require('request');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({apiVersion: '2006-03-01', region: 'us-west-2'});

http.createServer(function (req, res) {
  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var token = query.token;
  var file = query.file;
  var welcome = query.welcome;
  var share = new Object({});
  share.type = "creative_share";
  share.shareFile = query.sharefile;
  share.shareFileId = query.sharefileid;
  share.shareUser = query.shareuser;
  share.shareWith = query.sharewith;
  share.unShare = query.unshare;
  var response = '';
  var email = '';
  request('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + token, function(error, response, body){
    json = JSON.parse(body);
    if (welcome && json.audience == '894390426468-fijr71g5jbhad0an4rg9ptm2nidru6lg.apps.googleusercontent.com'){
      //send welcome email
      var stomp = require('stompy'),
        client = stomp.createClient({host: 'kxp-mq1.sjc.i.kixeye.com'});
      var msg  = new Object({});
      msg.type = "creative_welcome";
      msg.email = welcome
      client.publish('/queue/creative_emails', JSON.stringify(msg));
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('1');
    } else if (file && json.email && json.email.indexOf("@kixeye.com") > -1){
      //display secure file
      var params = {
        Bucket: 'me-creatives',
        Key: file
      };
      s3.getObject(params, function(err, data) {
        if (err) {
          res.writeHead(400, {'Content-Type': 'text/plain'});
          res.write(err.message);
        } else {
          res.writeHead(200, {'Content-Type': 'text/plain'});
          res.write(data.Body);
        }
        res.end();
      });
    } else if (share.shareFile && json.audience && json.audience == '894390426468-fijr71g5jbhad0an4rg9ptm2nidru6lg.apps.googleusercontent.com'){
      //send share message to MQ
      var stomp = require('stompy'),
        client = stomp.createClient({host: 'kxp-mq1.sjc.i.kixeye.com'});
      client.publish('/queue/creative_shares', JSON.stringify(share));
      res.writeHead(200, {'Content-Type': 'text/plain'});
      res.end('1');
    } else {
      //403 Forbidden
      res.writeHead(403, {'Content-Type': 'text/plain'});
      res.end();
    }
  });
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');
