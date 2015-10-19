/*
Copyright 2012 Google Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Author: Eric Bidelman (ericbidelman@chromium.org)
*/

"use strict";


function GDocs(selector) {

  var SCOPE_ = 'https://www.googleapis.com/drive/v2/';
  var FIELDS = 'nextPageToken,items(iconLink%2CthumbnailLink%2CalternateLink%2Cowners(displayName%2CemailAddress)%2Cid%2CcreatedDate%2CmodifiedDate%2CwebContentLink%2CfileSize%2CimageMediaMetadata(width%2Cheight)%2Cpermissions(emailAddress%2Cid%2Cname%2Crole%2Ctype)%2Cproperties(key%2Cvalue)%2Cparents%2Fid%2Ctitle)';
  this.lastResponse = null;
  this.folderid = null;
  this.gameid = null;
  this.project = null;
  this.search = '';

  this.__defineGetter__('SCOPE', function() {
    return SCOPE_;
  });

  this.__defineGetter__('FOLDER_CHECK', function() {
    return SCOPE_ + 'files/root/children?q=title+%3D+\'--creatives.kixeye.com--\'';
  });

  this.__defineGetter__('CREATE_FOLDER', function() {
    return SCOPE_ + 'files';
  });

  this.__defineGetter__('DOCLIST_FEED', function() {
    //return SCOPE_ + 'files?maxResults=5&q=\''+this.folderid+'\'+in+parents+and+trashed+%3D+false&fields=' + FIELDS;
    if (this.search !== '') {
      return SCOPE_ + 'files?q='+this.search+'\''+this.folderid+'\'+in+parents+and+trashed+%3D+false&fields=' + FIELDS;
    } else {
      return SCOPE_ + 'files?q='+this.daterange+'\''+this.folderid+'\'+in+parents+and+trashed+%3D+false&fields=' + FIELDS;
    }
  });

  this.__defineSetter__('SEARCH', function(val) {
    if (val) {
      this.search = 'title+contains+\''+val+'\'+and+';
    } else {
      this.search = '';
    }
  });

  this.__defineGetter__('USER_CHECK', function() {
    return SCOPE_ + "files?q="+encodeURIComponent("properties has { key='creatives.kixeye.com' and value='true' and visibility='PUBLIC' }") + "&fields=" + FIELDS;
  });

  this.__defineGetter__('FOLDER_ID', function() {
    return this.folderid;
  });

  this.__defineGetter__('TAGGED_DOCS', function() {
    return SCOPE_ + "files?q=properties+has+%7B+key%3D'creatives.kixeye.com'+and+value%3D'true'+and+visibility%3D'PUBLIC'+%7D";
  });

  this.__defineSetter__('DOCLIST_FEED', function(val){
    this.folderid = val;
  });

  this.__defineSetter__('CURRENT_FILE', function(val){
    this.fileid = val;
  });

  this.__defineSetter__('PERMISSIONID', function(val){
    this.permissionid = val;
  });

  this.__defineGetter__('UNLINK_FILE', function() {
    return SCOPE_ + 'files/'+this.fileid+'/parents/'+this.folderid;
  });

  this.__defineGetter__('UNTAG_FILE', function() {
    return SCOPE_ + 'files/'+this.fileid+'/properties/creatives.kixeye.com';
  });

  this.__defineGetter__('DELETE_FILE', function() {
    return SCOPE_ + 'files/'+this.fileid+'/trash';
  });

  this.__defineGetter__('TRASH_FILE', function() {
    return SCOPE_ + 'files/'+this.fileid+'/trash';
  });

  this.__defineGetter__('LINK_FILE', function() {
    return SCOPE_ + 'files/'+this.fileid+'/parents';
  });

  this.__defineGetter__('PERMISSIONS', function() {
    return SCOPE_ + 'files/'+this.fileid+'/permissions';
  });

  this.__defineGetter__('DELETE_PERMISSIONS', function() {
    return SCOPE_ + 'files/'+this.fileid+'/permissions/'+this.permissionid;
  });

  this.__defineGetter__('PROPERTIES', function() {
    return SCOPE_ + 'files/'+this.fileid+'/properties';
  });

  this.__defineGetter__('USERINFO_FEED', function() {
    return SCOPE_ + 'about';
  });

  this.__defineGetter__('CREATE_SESSION_URI', function() {
    return 'https://www.googleapis.com/upload/drive/v2/files?uploadType=resumable';
  });

  this.__defineGetter__('REFRESH_TOKEN_URI', function() {
    return 'https://www.googleapis.com/oauth2/v3/token';
  });

  this.__defineGetter__('DEFAULT_CHUNK_SIZE', function() {
    return 1024 * 1024 * 5; // 5MB;
  });
};

GDocs.prototype.auth = function(interactive, opt_callback) {
  try {
    var done = false;
    var self = this;
    var additionalParams = {
     'scope':'https://www.googleapis.com/auth/userinfo.email',
     'callback': function(authResult){
        if (authResult['status']['signed_in'] && done==false) {
          done = true;
          // Update the app to reflect a signed in user
          // Hide the sign-in button now that the user is authorized, for example:
          //document.getElementById('signinButton').setAttribute('style', 'display: none');
          if (authResult['access_token']) {
            self.accessToken = authResult['access_token'];
            var expireMs = parseInt(authResult['expires_at'] + '000');
            self.expiry = new Date(expireMs);
            self.expiry = self.expiry.toGMTString();
            document.cookie = "token=" + authResult['access_token'] + ';expires=' + self.expiry + ';path=/';
            document.cookie = "user=" + '';
            opt_callback && opt_callback();
          }
        } else {
          // Update the app to reflect a signed out user
          // Possible error values:
          //   "user_signed_out" - User is signed-out
          //   "access_denied" - User denied access to your app
          //   "immediate_failed" - Could not automatically log in the user
          //console.log('Sign-in state: ' + authResult['error']);
        }
      }
    };
    gapi.auth.signIn(additionalParams);
    //chrome.identity.getAuthToken({interactive: interactive}, function(token) {
    //  if (token) {
    //    this.accessToken = token;
    //    opt_callback && opt_callback();
    //  }
    //}.bind(this));
  } catch(e) {
    console.log(e);
  }
};

GDocs.prototype.removeCachedAuthToken = function(opt_callback) {
  if (this.accessToken) {
    var accessToken = this.accessToken;
    this.accessToken = null;
    // Remove token from the token cache.
    chrome.identity.removeCachedAuthToken({ 
      token: accessToken
    }, function() {
      opt_callback && opt_callback();
    });
  } else {
    opt_callback && opt_callback();
  }
};

GDocs.prototype.revokeAuthToken = function(opt_callback) {
  if (this.accessToken){
     /*$.ajax({
        type: 'GET',
        url: 'https://accounts.google.com/o/oauth2/revoke?token=' + this.accessToken,
        async: false,
        contentType: "application/json",
        dataType: 'jsonp',
        success: function(nullResponse) {
        },
        error: function(e) {
          console.log(e);
        }
      });*/
      var accessToken = this.accessToken;
      this.accessToken = null;
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

  }
}

GDocs.prototype.setFolderId = function(folderid){
  self = this;
  self.folderid = folderid;
}

/*
 * Generic HTTP AJAX request handler.
 */
GDocs.prototype.makeRequest = function(method, url, callback, opt_data, opt_headers) {
  var data = opt_data || null;
  var headers = opt_headers || {};

  var xhr = new XMLHttpRequest();
  xhr.open(method, url, true);

  // Include common headers (auth and version) and add rest. 
  xhr.setRequestHeader('Authorization', 'Bearer ' + this.accessToken);
  for (var key in headers) {
    xhr.setRequestHeader(key, headers[key]);
  }

  xhr.onload = function(e) {
    this.lastResponse = this.response;
    callback(this.lastResponse, this);
  }.bind(this);
  xhr.onerror = function(e) {
    console.log(this, this.status, this.response,
                this.getAllResponseHeaders());
  };
  xhr.send(data);
};



/**
 * Uploads a file to Google Docs.
 */
GDocs.prototype.upload = function(blob, callback, retry) {
  var onComplete = function(response) {
      //document.getElementById('main').classList.remove('uploading');
      var entry = JSON.parse(response).entry;
      callback.apply(this, [response]);
    }.bind(this);
  var onError = function(response) {
      if (retry) {
        this.removeCachedAuthToken(
            this.auth.bind(this, true, 
                this.upload.bind(this, blob, callback, false)));
      } else {
        //document.getElementById('main').classList.remove('uploading');
        throw new Error('Error: '+response);
      }
    }.bind(this);
  var uploader = new MediaUploader({
    token: this.accessToken,
    file: blob,
    folder: this.folderid,
    game: this.gameid,
    project: this.project,
    onComplete: onComplete,
    onError: onError
  });

  //document.getElementById('main').classList.add('uploading');
  uploader.upload();

};


