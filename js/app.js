function onError(e) {
  console.log(e);
}

$('.date').datepicker({
    format: "yyyy-mm-dd",
    endDate: "now",
    autoclose: true
});

$('input.start_date').on('changeDate', function (ev) {
  $('input.start_date').datepicker('setDate', ev.date);
  $('input.start_date').datepicker('update');
});

$('input.end_date').on('changeDate', function (ev) {
  $('input.end_date').datepicker('setDate', ev.date);
  $('input.end_date').datepicker('update');
});

var start_date = new Date();
var end_date = new Date();
start_date.setDate(start_date.getDate() - 14);
end_date.setDate(end_date.getDate());

$('input.start_date').datepicker('setDate', start_date);
$('input.start_date').datepicker('update');
$('input.end_date').datepicker('setDate', end_date);
$('input.end_date').datepicker('update');

$('form#myDateRange').submit(function (e) {
  $('#fileSearch input').val('');
});

var gDriveApp = angular.module('gDriveApp', ['ui.bootstrap', 'datatables']);

gDriveApp.factory('gdocs', function() {
  var gdocs = new GDocs();

  var dnd = new DnDFileController('body', function(files) {
    $('.overlay').hide();
    $(".uploadGameButtons button").removeClass("btn-info");
    $('#uploadModal').modal();
    var $scope = angular.element(this).scope();
    $scope.files = files;
  });

  return gdocs;
});
gDriveApp.directive('dropTarget', function() {
  return function($scope, $element){
    $scope.tid = 0;
    $element.bind('dragover', function() {
        clearTimeout($scope.tid);
        $('.overlay').show();
    });
    $element.bind('dragleave', function() {
        $scope.tid = setTimeout(function(){
          $('.overlay').hide();
        }, 0);
    });
  };
});
gDriveApp.directive('filterIcon', function() {
  return function($scope, $element){
    $element.bind('click', function() {
      $(this).toggleClass("btn-default");
      $scope.filter = '';
      $.each($(this).siblings(".btn-default").addBack(".btn-default"), function(index, value) {
        $scope.filter += $(value).children('.game-label').html() + '|';
      });
      var table = $(this).parents('.panel').find('.dataTable');
      var searchstring = "(" + $scope.filter.substring(0,$scope.filter.length-1) + ")(.* " + ($scope.search ? $scope.search : '') + ")";
      console.log(searchstring);
      table.DataTable().search(searchstring, true).draw();
    });
  };
});
gDriveApp.directive('searchBox', function() {
  return function($scope, $element){
    $element.bind('keyup', function(event) {
      if (event.which === 13){
        if ($(this).val()){
          $scope.fetchDocs(false, $(this).val());
        } else {
          $scope.fetchDocs();
        }
        //$scope.search = $(this).val();
        //var table = $(this).parents('.panel').find('.dataTable');
        //var searchstring = "(" + ($scope.filter ? $scope.filter.substring(0,$scope.filter.length-1) : '')+ ")(.* " + ($scope.search ? $scope.search : '') + ")";
        //table.DataTable().search(searchstring, true).draw();
      }
    });
  };
});
gDriveApp.filter('bytes', function() {
  return function(bytes, precision) {
    if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
    if (typeof precision === 'undefined') precision = 1;
    var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
      number = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
  };
});
gDriveApp.controller('DocsController', function ($scope, $http, $q, gdocs, $timeout, DTOptionsBuilder, DTColumnDefBuilder){
  $scope.toDate = new Date();
  $scope.toDate.setDate($scope.toDate.getDate() - 1);
  $scope.fromDate = new Date($scope.toDate-2592000000);
  $scope.docs = [];
  $scope.sharedDocs = [];
  $scope.folderid = [];
  $scope.projectList = [];
  $scope.uploadDoc = [];
  $scope.uploadDoc.users = [];
  $scope.uploadDoc.uploadTeamPermissions = new Object({});
  $scope.uploadDoc.uploadTeamPermissions['BP'] = false;
  $scope.uploadDoc.uploadTeamPermissions['WC'] = false;
  $scope.uploadDoc.uploadTeamPermissions['VC'] = false;
  $scope.uploadDoc.uploadTeamPermissions['WCM'] = false;
  $scope.uploadDoc.uploadTeamPermissions['SF'] = false;
  $scope.uploadDoc.uploadTeamPermissions['KM'] = false;
  $scope.filesLoaded = false;
  $scope.uploading = false;
  $scope.fileArray = [];
  $scope.pageToken = '';
  $scope.filter = '';
  $scope.projectFilter = '';
  $scope.myProjectFilter = '';
  $scope.myProjects = [];
  $scope.sharedProjects = [];
  $scope.sharedProjectsList = [];
  $scope.contactList = [];
  $scope.dtOptions = {
        "bInfo": false,
        "bLengthChange": false,
        "dom": 'lrtip',
        "bProcessing":true,
        "bSortClasses":false,
        "searchDelay":400,
        "iDisplayLength":20,
        "order": [[5, 'desc']],
        "language": {
          "emptyTable":" "
        },
        "fnDrawCallback": function(oSettings) {
              if (oSettings._iDisplayLength > oSettings.fnRecordsDisplay()) {
                  $(oSettings.nTableWrapper).find('.dataTables_paginate').hide();
              }
          },
          "autoWidth": false};
  $scope.dtColumnDefs = [
    DTColumnDefBuilder.newColumnDef(0)
      .withOption('width', '25px')
      .withOption('orderable', false),
    DTColumnDefBuilder.newColumnDef(1)
      .withOption('width', '250px'),
    DTColumnDefBuilder.newColumnDef(2)
      .withOption('className', 'dt-center')
      .withOption('width','40px'),
    DTColumnDefBuilder.newColumnDef(3)
      .withOption('width', '60px'),
    DTColumnDefBuilder.newColumnDef(4)
      .withOption('width', '51px'),
    DTColumnDefBuilder.newColumnDef(5)
      .withOption('width', '51px'),
    DTColumnDefBuilder.newColumnDef(6)
      .withOption('width', '120px'),
    DTColumnDefBuilder.newColumnDef(7)
      .withOption('width', '80px')
      .withOption('orderable', false)
      .withOption('className', 'dt-right')
  ];
  //$scope.slides = [{"image":"images/upload.jpg"},{"image":"images/search.jpg"},{"image":"images/sharebtn.jpg"},{"image":"images/share.jpg"}];
  // Response handler that caches file icons in the filesystem API.
  function successCallbackWithFsCaching(resp, status, headers, config) {
    var docs = [];
    var sharedDocs = [];
    var totalEntries = resp.length;
    var allUsers = [];
    var contactList = [];
    $scope.contactList = [];
    resp.forEach(function(entry, i) {
      var game=null;
      var project=null;
      if (entry.properties){
        for(var x=0; x<entry.properties.length; x++){
          if (entry.properties[x].key == 'game'){
            game = entry.properties[x].value;
          }
          if (entry.properties[x].key == 'project'){
            project = entry.properties[x].value;
            $scope.projectList.push(entry.properties[x].value);
            $scope.projectList = jQuery.unique($scope.projectList);
          }
        }
      }
      var sharedUsersHtml = "";
      var sharedUsersCount = 0;
      for (i=0; i<entry.permissions.length; i++){
      	if (entry.permissions[i].emailAddress){	
          $scope.contactList.push(entry.permissions[i].emailAddress);
          if (entry.permissions[i].emailAddress!=entry.owners[0].emailAddress){
            sharedUsersHtml += entry.permissions[i].emailAddress + "<BR>";
  	      	sharedUsersCount++;
          }
      	}
      }
      var doc = {
        id: entry.id,
        title: entry.title,
        updatedDate: Util.formatDate(entry.modifiedDate),
        updatedDateFull: entry.modifiedDate,
        game: game,
        project: project,
        owners: entry.owners,
        fileSize: entry.fileSize,
        metaData: entry.imageMediaMetadata,
        createdDate: entry.createdDate,
        modifiedDate: entry.modifiedDate,
        thumbnailLink: (entry.thumbnailLink ? entry.thumbnailLink.substring(0, entry.thumbnailLink.length-5): entry.iconLink),
        realThumbnail: entry.thumbnailLink,
        alternateLink: entry.alternateLink,
        parents: entry.parents,
        webContentLink: entry.webContentLink,
        sharedUsers: entry.permissions,
        sharedUsersHtml: sharedUsersHtml,
        sharedUsersCount: sharedUsersCount,
        size: entry.fileSize ? '( ' + entry.fileSize + ' bytes)' : null
      };
      var owner = false;
      for (var x=0; x<entry.owners.length; x++){
        if(entry.owners[x].emailAddress == $scope.user[0]){
          owner = true;
          break;
        }
      }
      if (owner){
       $scope.docs.push(doc);
       if (project && $scope.myProjects.indexOf(project) == -1){
          $scope.myProjects.push({'label':project,'title':project,'value':project});
       }
      } else {
       $scope.sharedDocs.push(doc);
       if (project && $scope.sharedProjectsList.indexOf(project) == -1){
          $scope.sharedProjectsList.push(project);
          $scope.sharedProjects.push({'label':project,'title':project,'value':project});
       }
      }
      if (totalEntries - 1 == i) {
        $scope.docs && $scope.docs.sort(Util.sortByDate);
        $scope.sharedDocs && $scope.sharedDocs.sort(Util.sortByDate);
      }
      $('#shared-project-select').multiselect('dataprovider',$scope.sharedProjects);
      $('#my-project-select').multiselect('dataprovider',$scope.myProjects);
      $scope.filesLoaded = true;
    });
    $scope.contactList = $.unique($scope.contactList);
  }

  $scope.clearDocs = function() {
    $scope.fileArray = [];
    $scope.docs = []; // Clear out old results.
    $scope.sharedDocs = []; // Clear out old results.
  };

  $scope.folderCheck = function() {
    //this.clearDocs();
    if (gdocs.accessToken) {
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
      $http.get(gdocs.FOLDER_CHECK, config).
        success(function(data, status, headers, config){
          if (!data.items[0]){
            $scope.createFolder();
          } else {
            gdocs.DOCLIST_FEED = data.items[0].id;
            var promise = $scope.syncDocs();
            promise.then(function(){
              $scope.fetchDocs();
            });
          }
        });
    }
  };

  $scope.createFolder = function() {
    var data = {
      'title': '--creatives.kixeye.com--',
      'parents':[{'id':'root'}],
      'mimeType': 'application/vnd.google-apps.folder'
    };
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    $http.post(gdocs.CREATE_FOLDER, data, config).
      success(function(data, status, headers, config){
        gdocs.DOCLIST_FEED = data.id;
        var promise = $scope.syncDocs();
        promise.then(function(){
          //if we're creating the folder, this is probably a first-time user, so send them the welcome email
          setTimeout(function(){
            $.ajax({
              type: "GET",
              url: "/server/?welcome=" + $scope.user[0] + "&token=" + gdocs.accessToken
            });
            $scope.fetchDocs();
          },2000);
        });
      });
  };

  $scope.tagFile = function(id) {
    gdocs.CURRENT_FILE = id;
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken,
          'Content-Type': 'application/json'
        }
      };
      var data = {
        "kind": "drive#property",
        "key": "creatives.kixeye.com",
        "visibility": "public",
        "value": true
      };
      $http.post(gdocs.PROPERTIES, data, config).
          error(function(data, status, headers, config) {
            //console.log(data);
          });
  };

  $scope.putFile = function(id) {
    gdocs.CURRENT_FILE = id;
    var data = {
      'id': gdocs.FOLDER_ID
    };
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken
      }
    };
    $http.post(gdocs.LINK_FILE, data, config).
      error(function(data, status, headers, config) {
          //console.log(data);
        });
  };

  $scope.syncDocs = function() {
    var deferred = $q.defer();
    if (gdocs.accessToken) {
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
      $scope.start_daterange = $('input.start_date').val() + 'T23:59:59';
      $scope.end_daterange = $('input.end_date').val() + 'T23:59:59';
      gdocs.daterange = encodeURIComponent("modifiedDate > '"+$scope.start_daterange+"' and modifiedDate < '"+$scope.end_daterange+"' and");
      // get files in creatives folder
      $http.get(gdocs.DOCLIST_FEED, config).
        success(function(data, status, headers, config){
          // for each file in folder, if there's no tag, tag it
          var items = data.items;
          var needTags = [];
          for(var x=0; x<items.length; x++){
            var tagged = false;
            if (data.items[x].properties) {
              for(var y=0; y<data.items[x].properties.length; y++){
                if (data.items[x].properties[y].key == 'creatives.kixeye.com') {
                  tagged = true;
                }
              }
            }
            if (!tagged){
              //there's no tag, let's tag this file
              needTags.push($scope.tagFile(data.items[x].id));
            }
          }
          if (needTags.length > 0){
            $q.all(needTags)
              .then(function(results){
                // get files tagged creatives
                $http.get(gdocs.TAGGED_DOCS, config).
                  success(function(data, status, headers, config){
                    // for each file in tags, if it's not in the folder, put it there
                    var items = data.items;
                    var needFolder = [];
                    for(var x=0; x<items.length; x++){
                      var infolder = false;
                      for(var y=0; y<data.items[x].parents.length; y++){
                        if (data.items[x].parents[y].id == gdocs.FOLDER_ID) {
                          infolder = true;
                        }
                      }
                      if (!infolder){
                        //it's not in the folder, let's put it there
                        needFolder.push($scope.putFile(data.items[x].id));
                      }
                    }
                    if (needFolder.length > 0){
                      $q.all(needFolder)
                        .then(function(results){
                          deferred.resolve();
                        });
                    } else {
                      deferred.resolve();
                    } 
                  });
              });
          } else {
            // get files tagged creatives
            $http.get(gdocs.TAGGED_DOCS, config).
              success(function(data, status, headers, config){
                // for each file in tags, if it's not in the folder, put it there
                var items = data.items;
                var needFolder = [];
                for(var x=0; x<items.length; x++){
                  var infolder = false;
                  for(var y=0; y<data.items[x].parents.length; y++){
                    if (data.items[x].parents[y].id == gdocs.FOLDER_ID) {
                      infolder = true;
                    }
                  }
                  if (!infolder){
                    //it's not in the folder, let's put it there
                    needFolder.push($scope.putFile(data.items[x].id));
                  }
                }
                if (needFolder.length > 0){
                  $q.all(needFolder)
                    .then(function(results){
                      deferred.resolve(); 
                    });
                } else {
                  deferred.resolve();
                } 
              });
          }
        }).
        error(function(data, status, headers, config) {
          if (status == 401 && retry) {
            gdocs.removeCachedAuthToken(
                gdocs.auth.bind(gdocs, true, 
                    $scope.fetchDocs.bind($scope, false)));
          }
          deferred.resolve();
        });
    } else {
      deferred.resolve();
    }
    return deferred.promise;
  };

  $scope.fetchDocs = function(retry, search) {
    $scope.start_daterange = $('input.start_date').val() + 'T23:59:59';
    $scope.end_daterange = $('input.end_date').val() + 'T23:59:59';

    gdocs.daterange = encodeURIComponent("modifiedDate > '"+$scope.start_daterange+"' and modifiedDate < '"+$scope.end_daterange+"' and ");
    
    if (search){
      gdocs.SEARCH = search;
    } else {
      var search_phrase = $('#fileSearch input').val();
      if (search_phrase !== '') {
        gdocs.SEARCH = search_phrase;
      } else {
        gdocs.SEARCH = null;
      }
    }

    $('#shared-project-select').multiselect({
      buttonClass : 'btn btn-sm btn-default',
      buttonText : function(){return '<span class="glyphicon glyphicon-folder-open"></span>';},
      onChange : function(option, checked, select){
        $scope.projectFilter = '';
        if ($('#shared-project-select').val()){
          $.each($('#shared-project-select').val(), function(index, value) {
            $scope.projectFilter += '('+value+')|';
          });
        }
        var searchString = "(" + ($scope.projectFilter ? $scope.projectFilter.substring(0,$scope.projectFilter.length-1) : '') + ")(" + ($scope.filter ? $scope.filter.substring(0,$scope.filter.length-1) : '') + ")(.* " + ($scope.search ? $scope.search : '') + ")";
        $('#sharedWithMeTable').DataTable().search(searchString, true).draw();
      }
    });

    $('#my-project-select').multiselect({
      buttonClass : 'btn btn-sm btn-default',
      buttonText : function(){return '<span class="glyphicon glyphicon-folder-open"></span>';},
      onChange : function(option, checked, select){
        $scope.myProjectFilter = '';
        if ($('#my-project-select').val()){
          $.each($('#my-project-select').val(), function(index, value) {
            $scope.myProjectFilter += '('+value+')|';
          });
        }
        var searchString = "(" + ($scope.myProjectFilter ? $scope.myProjectFilter.substring(0,$scope.myProjectFilter.length-1) : '') + ")(" + ($scope.filter ? $scope.filter.substring(0,$scope.filter.length-1) : '') + ")(.* " + ($scope.search ? $scope.search : '') + ")";
        $('#myFilesTable').DataTable().search(searchString, true).draw();
      }
    });

    if (gdocs.accessToken) {
      var url = '';
      if ($scope.pageToken){
        url = gdocs.DOCLIST_FEED+'&pageToken='+$scope.pageToken;
      } else {
        $scope.clearDocs();
        url = gdocs.DOCLIST_FEED;
      }
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
      $scope.filesLoaded = false;
      $http.get(url, config).
        success(function(data, status, headers, config){
          for (var i = 0; i < data.items.length; i++){
            $scope.fileArray.push(data.items[i]);
          }
          if (data.nextPageToken){
            $scope.pageToken = data.nextPageToken;
            $scope.fetchDocs();
          } else {
            $scope.pageToken = '';
            successCallbackWithFsCaching($scope.fileArray, status, headers, config);
          }
        }).
        error(function(data, status, headers, config) {
          if (status == 401 && retry) {
            gdocs.removeCachedAuthToken(
                gdocs.auth.bind(gdocs, true, 
                    $scope.fetchDocs.bind($scope, false)));
          }
        });
    }
  };

  $scope.deleteFile = function(file){
    gdocs.CURRENT_FILE = file.id;
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken
      }
    };
    $http.post(gdocs.DELETE_FILE, null, config)
      .success(function() {
        $scope.filesLoaded = false;      
        $scope.fileArray = [];
        $scope.clearDocs();
        $timeout(function(){$scope.fetchDocs();}, 1000);
      })
      .error(function(data, status, headers, config) {
        if (status == 401 && retry) {
          gdocs.removeCachedAuthToken(
              gdocs.auth.bind(gdocs, true, 
                  $scope.fetchDocs.bind($scope, false)));
        }
      });
  };

  $scope.deleteSharedFile = function(file){
    gdocs.CURRENT_FILE = file.id;
    for(var i=0; i<file.sharedUsers.length; i++) {
      if(file.sharedUsers[i].emailAddress == $scope.user[0]){
        gdocs.PERMISSIONID = file.sharedUsers[i].id;
      }
    }
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken,
          'Content-Type': 'application/json'
        }
      };
      $http.delete(gdocs.DELETE_PERMISSIONS, config).
        success(function() {
          $scope.fetchDocs();
        });
  };

  $scope.unlinkFile = function(file){
    gdocs.CURRENT_FILE = file.id;
    var data = {
      'id': 'root'
    };
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken
      }
    };
    var config2 = {
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken
      }
    };
    $http.delete(gdocs.UNLINK_FILE, config).
      success(function(){
        $http.post(gdocs.LINK_FILE, data, config)
          .success(function(){
            $http.delete(gdocs.UNTAG_FILE, config2)
              .success(function(){
                $scope.fetchDocs();
              });
          });
      }).error(function(data, status, headers, config) {
        if (status == 401 && retry) {
          gdocs.removeCachedAuthToken(
              gdocs.auth.bind(gdocs, true, 
                  $scope.fetchDocs.bind($scope, false)));
        }
      });
  };

  $scope.clearUser = function() {
    // Clear out old results.
    $scope.user = [];
  };

  $scope.getCookie = function(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1);
      if (c.indexOf(name) == 0) return c.substring(name.length,c.length);
    }
    return false;
  };

  $scope.fetchUser = function() {
    var deferred = $q.defer();
    this.clearUser();
    if (gdocs.accessToken) {
      if($scope.getCookie('user')){
        $scope.user[0] = $scope.getCookie('user');
        deferred.resolve();
      } else {
        var config = {
          params: {'alt': 'json'},
          headers: {
            'Authorization': 'Bearer ' + gdocs.accessToken
          }
        };
        $http.get(gdocs.USERINFO_FEED, config).
          success(function(data, status, headers, config){
            $scope.user[0] = data.user.emailAddress;
            document.cookie = "user=" + data.user.emailAddress;
            deferred.resolve();
          });
      }
    }
    return deferred.promise;
  };

  $scope.userCheck = function() {
    if ($scope.user[0].indexOf("@kixeye.com") < 0){
      //check and see that there are creatives.kixeye.com 
      //files shared with the user, if this isn't a kixeye.com user.
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken
        }
      };
      $http.get(gdocs.USER_CHECK, config).
        success(function(resp, status, headers, config){
          var allUsers = [];
           for(var x=0; x<resp.items.length; x++){
            for(var y=0; y<resp.items[x].permissions.length; y++){
              if (resp.items[x].permissions[y].emailAddress){
                allUsers.push(resp.items[x].permissions[y].emailAddress);
              }
            }
           }
           var uniqueUsers = $.unique(allUsers);
           if (uniqueUsers.indexOf($scope.user[0]) < 0){
            $scope.invalidUser = true;
           } else {
            $scope.validUser = true;
            $scope.folderCheck();
           }
        });
    } else {
      $.ajax({
        xhrFields: {
            withCredentials: true
        },
        type: "GET",
        url: "/server/?file=creatives-vc-ios.txt&token=" + gdocs.accessToken
      }).done(function (data) {
          $('#vc-ios-tab').html(data);
          $('#vc-ios-tab img').attr('draggable',false);

      });

      $.ajax({
        xhrFields: {
            withCredentials: true
        },
        type: "GET",
        url: "/server/?file=creatives-vc-android.txt&token=" + gdocs.accessToken
      }).done(function (data) {
          $('#vc-android-tab').html(data);
          $('#vc-android-tab img').attr('draggable',false);

      });

      $.ajax({
        xhrFields: {
            withCredentials: true
        },
        type: "GET",
        url: "/server/?file=creatives-wcra.txt&token=" + gdocs.accessToken
      }).done(function (data) {
          $('#wcra-tab').html(data);
          $('#wcra-tab img').attr('draggable',false);
      });
      $scope.kixeyeUser = true;
      $scope.validUser = true;
      $scope.folderCheck();
    }
  };

  // Toggles the authorization state.
  $scope.toggleAuth = function(interactive) {
    if (!gdocs.accessToken) {
      if ($scope.getCookie('token')){
        gdocs.accessToken = $scope.getCookie('token');
        var promise = $scope.fetchUser();
        promise.then(function(){
          $scope.userCheck();
        });
      } else {
        gdocs.auth(interactive, function() {
          var promise = $scope.fetchUser();
          promise.then(function(){
            $scope.userCheck();
          });
        });
      }
    } else {
      gdocs.revokeAuthToken(function() {});
      //this.clearDocs();
      $scope.user = false;
      $scope.invalidUser = false;
      $scope.validUser = false;
    }
  };

  $scope.infoButton = function(doc) {
    //console.log(doc);
    $scope.selectedDoc = doc;
    $("#infoModal").modal();
  };

  $scope.shareButton = function (doc) {
    $scope.selectedDoc = doc;
    gdocs.CURRENT_FILE = doc.id;
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    $scope.selectedDoc.permissions = [];
    $scope.selectedDoc.teamPermissions = new Object({});
    $scope.selectedDoc.teamPermissions['BP'] = false;
    $scope.selectedDoc.teamPermissions['WC'] = false;
    $scope.selectedDoc.teamPermissions['VC'] = false;
    $scope.selectedDoc.teamPermissions['WCM'] = false;
    $scope.selectedDoc.teamPermissions['SF'] = false;
    $scope.selectedDoc.teamPermissions['KM'] = false;
    $scope.selectedDoc.pmPermission = null;
    $scope.selectedDoc.uaPermission = null;
    $scope.selectedDoc.mePermission = null;
    $('input[name="ua-share"], input[name="pm-share"], input[name="me-share"]').bootstrapSwitch('state', false, true);
    for(var x=0; x<$scope.selectedDoc.sharedUsers.length; x++){
      if ($scope.selectedDoc.sharedUsers[x].type!='domain' && $scope.selectedDoc.sharedUsers[x].role!='owner'){
        switch($scope.selectedDoc.sharedUsers[x].emailAddress){
          case 'creatives-user-acquisition@kixeye.com':
            $('input[name="ua-share"]').bootstrapSwitch('state', true, true);
            $scope.selectedDoc.uaPermission = $scope.selectedDoc.sharedUsers[x];
            break;
          case 'creatives-product-marketing@kixeye.com':
            $('input[name="pm-share"]').bootstrapSwitch('state', true, true);
            $scope.selectedDoc.pmPermission = $scope.selectedDoc.sharedUsers[x];
            break;
          case 'me-creatives@kixeye.com':
            $('input[name="me-share"]').bootstrapSwitch('state', true, true);
            $scope.selectedDoc.mePermission = $scope.selectedDoc.sharedUsers[x];
            break;
          case 'creatives-bp-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['BP'] = true;
            break;
          case 'creatives-wc-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['WC'] = true;
            break;
          case 'creatives-vc-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['VC'] = true;
            break;
          case 'creatives-wcm-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['WCM'] = true;
            break;
          case 'creatives-sf-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['SF'] = true;
            break;
          case 'creatives-km-pms@kixeye.com':
            $scope.selectedDoc.teamPermissions['KM'] = true;
            break;
          default:
            $scope.selectedDoc.permissions.push($scope.selectedDoc.sharedUsers[x]);
            break;
        }
      }
    }
    $("#shareModal").modal();
  };

  $('input[name="ua-share"]').on('switchChange.bootstrapSwitch', function(event, state) {
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    if (state){
      //state true, add to permissions
      var data = {
        'role': 'writer',
        'type':'group',
        'value':'creatives-user-acquisition@kixeye.com',
        'additionalRoles': ['commenter']
      };
      $http.post(gdocs.PERMISSIONS+'?sendNotificationEmails=false', data, config).
        success(function(data, status, headers, config){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'creatives-user-acquisition@kixeye.com');
          $scope.selectedDoc.uaPermission = data;
          gdocs.PERMISSIONID = data.id;
          $scope.fetchDocs();
        });
    } else {
      gdocs.PERMISSIONID = $scope.selectedDoc.uaPermission.id;
      //state false, remove from permissions
      $http.delete(gdocs.DELETE_PERMISSIONS, config)
        .success(function(){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'creatives-user-acquisition@kixeye.com', true);
          $scope.fetchDocs();
        });
    }
  });

  $('input[name="pm-share"]').on('switchChange.bootstrapSwitch', function(event, state) {
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    if (state){
      //state true, add to permissions
      var data = {
        'role': 'writer',
        'type':'group',
        'value':'creatives-product-marketing@kixeye.com',
        'additionalRoles': ['commenter']
      };
      $http.post(gdocs.PERMISSIONS+'?sendNotificationEmails=false', data, config).
        success(function(data, status, headers, config){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'creatives-product-marketing@kixeye.com');
          $scope.selectedDoc.pmPermission = data;
          gdocs.PERMISSIONID = data.id;
          $scope.fetchDocs();
        });
    } else {
      gdocs.PERMISSIONID = $scope.selectedDoc.pmPermission.id;
      //state false, remove from permissions
      $http.delete(gdocs.DELETE_PERMISSIONS, config)
        .success(function(){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'creatives-product-marketing@kixeye.com', true);
          $scope.fetchDocs();
        });
    }
  });

  $('input[name="me-share"]').on('switchChange.bootstrapSwitch', function(event, state) {
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    if (state){
      //state true, add to permissions
      var data = {
        'role': 'writer',
        'type':'group',
        'value':'me-creatives@kixeye.com',
        'additionalRoles': ['commenter']
      };
      $http.post(gdocs.PERMISSIONS+'?sendNotificationEmails=false', data, config).
        success(function(data, status, headers, config){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'me-creatives@kixeye.com');
          $scope.selectedDoc.mePermission = data;
          gdocs.PERMISSIONID = data.id;
          $scope.fetchDocs();
        });
    } else {
      gdocs.PERMISSIONID = $scope.selectedDoc.mePermission.id;
      //state false, remove from permissions
      $http.delete(gdocs.DELETE_PERMISSIONS, config)
        .success(function(){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, 'me-creatives@kixeye.com', true);
          $scope.fetchDocs();
        });
    }
  });
  
  $scope.addUploadTeam = function(name, isShared){
    if (isShared){
      $scope.uploadDoc.uploadTeamPermissions[name] = false;
    } else {
      $scope.uploadDoc.uploadTeamPermissions[name] = true;
    }
  };

  $scope.addTeam = function(name, isShared) {
    var teamEmail = null;
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    switch(name){
      case 'BP':
        teamEmail = 'creatives-bp-pms@kixeye.com';
        break;
      case 'WC':
        teamEmail = 'creatives-wc-pms@kixeye.com';
        break;
      case 'VC':
        teamEmail = 'creatives-vc-pms@kixeye.com';
        break;
      case 'WCM':
        teamEmail = 'creatives-wcm-pms@kixeye.com';
        break;
      case 'SF':
        teamEmail = 'creatives-sf-pms@kixeye.com';
        break;
      case 'KM':
        teamEmail = 'creatives-km-pms@kixeye.com';
        break;
    }
    if(isShared){
      //shared, remove permission
      var teamPermissionId = false;
      for(var y=0; y<$scope.selectedDoc.sharedUsers.length; y++){
        if ($scope.selectedDoc.sharedUsers[y].emailAddress == teamEmail) {
          teamPermissionId = $scope.selectedDoc.sharedUsers[y].id;
        }
      }
      if(teamPermissionId){
        gdocs.PERMISSIONID = teamPermissionId;
        $http.delete(gdocs.DELETE_PERMISSIONS, config).
          success(function() {
            $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, teamEmail, true);
            $scope.selectedDoc.teamPermissions[name] = false;
            $scope.fetchDocs();
          });
      }
    } else {
      //not shared, add permission
      var data = {
        'role': 'writer',
        'type':'group',
        'value':teamEmail,
        'additionalRoles': ['commenter']
      };
      $http.post(gdocs.PERMISSIONS+'?sendNotificationEmails=false', data, config).
        success(function(data, status, headers, config){
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, teamEmail);
          $scope.selectedDoc.teamPermissions[name] = true;
          $scope.fetchDocs(true);
        });
    }
  };
  
  $scope.removeUploadPermission = function(index){
    $scope.uploadDoc.users.splice(index, 1);
  };

  $scope.removePermission = function(permission, i){
      gdocs.PERMISSIONID = permission.id;
      var config = {
        params: {'alt': 'json'},
        headers: {
          'Authorization': 'Bearer ' + gdocs.accessToken,
          'Content-Type': 'application/json'
        }
      };
      $http.delete(gdocs.DELETE_PERMISSIONS, config).
        success(function() {
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, permission.emailAddress, true);
          $scope.selectedDoc.permissions.splice(i, 1);
          $scope.fetchDocs();
        });
  };
  $scope.validateEmail = function($email) {
    var emailReg = /^([\w-\.]+@([\w-]+\.)+[\w-]{2,4})?$/;
    return emailReg.test( $email );
  };

  $scope.shareFileUpload = function() {
    if ($scope.validateEmail($scope.shareWithUpload)) {
      var unique = true;
      for(var y=0; y<$scope.uploadDoc.users.length; y++){
        if ($scope.uploadDoc.users[y].emailAddress == $scope.shareWithUpload){
          unique = false;
        }
      }
      if(unique){
        $scope.uploadDoc.users.push({'emailAddress':$scope.shareWithUpload});
      }
    } else {
      $('#shareEmail').val('');
      $('#shareEmail').attr('placeholder', 'Invalid email address.');
    }
  };

  $scope.shareFile = function(shareUser, shareType, defaultNotif){
    shareType = shareType ? shareType : 'user';
    defaultNotif = defaultNotif ? defaultNotif : false;
    var config = {
      params: {'alt': 'json'},
      headers: {
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      }
    };
    var data = {
        'role': 'writer',
        'type':shareType,
        'value':shareUser,
        'additionalRoles': ['commenter']
      };
    var emailText = $scope.user[0] + ' has shared a file with you via http://creatives.kixeye.com:';
    $http.post(gdocs.PERMISSIONS+'?sendNotificationEmails='+defaultNotif+'&emailMessage='+emailText, data, config).
        success(function(data, status, headers, config){
          $('#shareEmail').val('');
          if (data.name){
            $scope.selectedDoc.permissions.push(data);
            $timeout(function(){$scope.fetchDocs();}, 1000);
          } else {
            data = {"emailAddress":shareUser};
            $scope.selectedDoc.permissions.push(data);
            $timeout(function(){$scope.fetchDocs();}, 1000);
          }
          $scope.shareEmail($scope.selectedDoc.id, $scope.selectedDoc.title, shareUser);
        }).
        error(function(data, status, headers, config) {
          if (status == 400 && data.error.message.substring(0,52) == 'Bad Request. User message: "You are trying to invite'){
            //this isn't a google user, send them the default google share message so that they can create a new account.
            $scope.shareFile(shareUser, shareType, true);
          } else {
            $('#shareEmail').val('');
            $('#shareEmail').attr('placeholder', 'Error adding user.');
          }
        });
  };

  $scope.deleteButton = function(doc) {
    $scope.selectedDoc = doc;
    $("#deleteModal").modal();
  };

  $scope.deleteButtonShared = function(doc) {
    $scope.selectedDoc = doc;
    $("#deleteModalShared").modal();
  };

  $scope.uploadButton = function() {
    var $scope = angular.element('body').scope();
    var uploadArray = [];
    $scope.uploading = true;
    Util.toArray($scope.files).forEach(function(file, i) {
      uploadArray.push($scope.uploader(file,i));
    });
      $q.all(uploadArray)
        .then(function(res){
          var shareUsers = [];
          var shareArray = [];
          var idArray = [];
          if ($("[name='ua-share-upload']").bootstrapSwitch('state')){
            shareUsers.push({"email":"creatives-user-acquisition@kixeye.com","type":"group"});
          }
          if ($("[name='pm-share-upload']").bootstrapSwitch('state')){
            shareUsers.push({"email":"creatives-product-marketing@kixeye.com","type":"group"});
          }
          if ($("[name='me-share-upload']").bootstrapSwitch('state')) {
            shareUsers.push({"email":"me-creatives@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.BP){
            shareUsers.push({"email":"creatives-bp-pms@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.WC){
            shareUsers.push({"email":"creatives-wc-pms@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.VC){
            shareUsers.push({"email":"creatives-vc-pms@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.WCM){
            shareUsers.push({"email":"creatives-wcm-pms@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.SF){
            shareUsers.push({"email":"creatives-sf-pms@kixeye.com","type":"group"});
          }
          if ($scope.uploadDoc.uploadTeamPermissions.KM){
            shareUsers.push({"email":"creatives-km-pms@kixeye.com","type":"group"});
          }
          for (var i=0; i < $scope.uploadDoc.users.length; i++){
            shareUsers.push({"email":$scope.uploadDoc.users[i].emailAddress,"type":"user"});
          }
          if(shareUsers.length){
            var batch = gapi.client.newBatch();
            for(var j=0; j < res.length; j++){
              file = JSON.parse(res[j]);
              for(var k=0; k < shareUsers.length; k++){
                var defaultNotif = false;
                if(shareUsers[k].email.indexOf("@kixeye.com") < 0){
                  //google account user, send standard email
                  defaultNotif = true;
                } else {
                  //kixeye.com user, send batch share email
                  $scope.shareEmail(file.id, file.title, shareUsers[k].email);
                }
                batch.add($scope.gapiShareFile(file.id,shareUsers[k].email,shareUsers[k].type, defaultNotif), {'id': file.id+'|'+shareUsers[k].email+'|'+shareUsers[k].type});
                //shareArray.push();
              }
            }
            batch
              .execute(function(map,json){
                var newUsers = false;
                var batch2 = gapi.client.newBatch();
                $.each(map, function(i, value){
                  if(value.result.error && value.result.error.message.substring(0,52) == 'Bad Request. User message: "You are trying to invite'){
                    newUsers = true;
                    var ida = i.split("|");
                    //user without google account, send standard google share email
                    batch2.add($scope.gapiShareFile(ida[0],ida[1],ida[2], true));
                  }
                  //console.log('file id: ' + ida[0]);
                  //console.log('shareUser: ' + ida[1]);
                  //console.log('shareUserType: ' + ida[2]);
                  //console.log('result: ' + (value.result.error ? value.result.error.message : 'OK'));
                });
                if(newUsers){
                  batch2.execute(function(map, json){
                    $("#uploadModal").modal('hide');
                    $scope.fileArray = [];
                    $scope.uploading = false;
                    $scope.fetchDocs();
                  });
                } else {
                  $("#uploadModal").modal('hide');
                  $scope.fileArray = [];
                  $scope.uploading = false;
                  $scope.fetchDocs();
                }
              });
          } else {
            $("#uploadModal").modal('hide');
            $scope.uploading = false;
            $scope.fileArray = [];
            $scope.fetchDocs();
          }
          
        });
  };

  $scope.gapiShareFile = function(id, shareUser, shareType, defaultNotif){
    defaultNotif = defaultNotif ? defaultNotif : false;
    return gapi.client.request({
      'path':'drive/v2/files/'+id+'/permissions',
      'params':{
        'alt':'json',
        'sendNotificationEmails':defaultNotif,
      },
      'method':'POST',
      'headers':{
        'Authorization': 'Bearer ' + gdocs.accessToken,
        'Content-Type': 'application/json'
      },
      'body':{
        'role': 'writer',
        'type':shareType,
        'value':shareUser,
        'additionalRoles': ['commenter']
      }
    });
  };

  $scope.shareEmail = function(id, title, sharewith, unshare) {
    $.ajax({
        type: "GET",
        url: "/server/?sharefileid=" + id + "&sharefile=" + title + "&sharewith=" + sharewith + "&shareuser=" + $scope.user[0] + "&unshare=" + unshare + "&token=" + gdocs.accessToken
      });
  };

  $scope.uploader = function(file, i){
    var deferred = $q.defer();
    gdocs.project = $scope.project;
    gdocs.upload(file, function(res) {
      deferred.resolve(res);
    }, true);
    return deferred.promise;
  };

  $scope.cancelButton = function() {
    //
    $(".uploadBtn").addClass('disabled');
  };

  $scope.gameSelectButton = function(game) {
    gdocs.gameid = game;
    $(".uploadBtn").removeClass('disabled');
  };

  $scope.filterButton = function(element) {
    //
    $(element).toggleClass("hidden");
  };

  $scope.searchButton = function(element) {
    //
    $(element).toggleClass("hidden");
  };

  $scope.alertClose = function(){
    //
    document.cookie = "alert-box=closed";
  };

  // Controls the label of the authorize/deauthorize button.
  $scope.authButtonLabel = function() {
    if (gdocs.accessToken){
      return 'Logout';
    } else{
      return 'Login';
    }
  };

  $scope.exportTableToCSV = function($table, filename) {

        var $rows = $table.find('tr:has(td), tr:has(th)'),
            // Temporary delimiter characters unlikely to be typed by keyboard
            // This is to avoid accidentally splitting the actual contents
            tmpColDelim = String.fromCharCode(11), // vertical tab character
            tmpRowDelim = String.fromCharCode(0), // null character

            // actual delimiter characters for CSV format
            colDelim = '","',
            rowDelim = '"\r\n"',

            // Grab text from table into CSV formatted string
            csv = '"' + $rows.map(function (i, row) {
                var $row = $(row),
                    $cols = $row.find('td');
                    if (!$cols.length){
                      $cols = $row.find('th');
                    }
                if ($row.attr('class').indexOf('hideme') == -1){
                  return $cols.map(function (j, col) {
                      var $col = $(col),
                          text = $col.text();
                          if (!text.length) {
                            text = $.parseHTML($col.html())[0].src;
                          }
                      if (text.length){
                        return text.replace(/"/g, '""'); // escape double quotes
                      }

                  }).get().join(tmpColDelim);
                }

            }).get().join(tmpRowDelim)
                .split(tmpRowDelim).join(rowDelim)
                .split(tmpColDelim).join(colDelim) + '"',

            // Data URI
            csvData = 'data:application/csv;charset=utf-8,' + encodeURIComponent(csv);
        $(this)
            .attr({
            'download': filename,
                'href': csvData,
                'target': '_blank'
        });
    };

  $("[name='pm-share'],[name='ua-share'],[name='me-share'],[name='pm-share-upload'],[name='ua-share-upload'],[name='me-share-upload']").bootstrapSwitch({size:"mini"});
  
  if ($scope.getCookie('token')){
    gdocs.accessToken = $scope.getCookie('token');
    var promise = $scope.fetchUser();
    promise.then(function(){
      $scope.userCheck();
    });
  }

  $('.uploadGameButtons button').on('click', function(){
    $(".uploadGameButtons button").removeClass("btn-primary");
    $(this).toggleClass("btn-primary");
  });

  $(".export").on('click', function (event) {
      // CSV
      $scope.exportTableToCSV.apply(this, [$(event.target).parent().parent().find('.tab-pane.active table'), 'export.csv']);
      
      // IF CSV, don't do event.preventDefault() or return false
      // We actually need this to be a typical hyperlink
  });



  //$('#vc-ios-tab').load('https://ua.sjc.i.kixeye.com/public/exports/casper_captures/creatives-vc-ios.txt', function() {
  //  console.log('load');
  //});

});