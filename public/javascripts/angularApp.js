var app = angular.module('flapperNews', ['ui.router','elasticsearch','ngSanitize','swaggerUi','ngPrettyJson'],['$locationProvider', function($locationProvider) {
  $locationProvider.html5Mode({
    enabled: true
  });
}]).config(function($provide) {
    $provide.decorator('$sniffer', function($delegate) {
      $delegate.history = false;
      return $delegate;
    });
});

app.config([
'$stateProvider',
'$urlRouterProvider',
function($stateProvider, $urlRouterProvider) {

  $stateProvider
    .state('home', {
      url: '/home',
      templateUrl: '/home.html',
      controller: 'MainCtrl',
      resolve: {
        postPromise: ['posts', function(posts) {
          return posts.getAll();
        }]
      }
    }).state('posts', {
      url: '/posts/{id}',
      templateUrl: '/posts.html',
      controller: 'PostsCtrl',
      resolve: {
        post: ['$stateParams','posts', function($stateParams, posts) {
          return posts.get($stateParams.id);
        }]
      }
    }).state('listing', {
      url: '/listing',
      templateUrl: '/listing.html',
      controller: 'ListingCtrl',
      resolve: {
        postPromise: ['posts', function(posts) {
          return posts.getAll();
        }]
      }
    }).state('new', {
      url: '/new',
      templateUrl: '/new.html',
      controller: 'NewCtrl'
    });

  $urlRouterProvider.otherwise('home');
}]);

app.factory('posts', ['$http', function($http){
  var o = {
    posts: []
  };
  o.getAll = function() {
    return $http.get('/posts').success(function(data){
      angular.copy(data, o.posts);
    });
  };
  o.create = function(post) {
    return $http.post('/posts', post).success(function(data){
      o.posts.push(data);
    });
  };
  o.get = function(id) {
    return $http.get('/posts/' + id).then(function(res){
      return res.data;
    });
  };
  return o;
}])

app.controller('MainCtrl', ['apiService', '$scope', '$location', function(apis, $scope, $location) {
  // Provide some nice initial choices
  var initChoices = [
      "Pet Store"
  ];
  var idx = Math.floor(Math.random() * initChoices.length);

  // Initialize the scope defaults.
  $scope.apis = [];        // An array of results to display
  $scope.page = 0;            // A counter to keep track of our current page
  $scope.allResults = false;  // Whether or not all results have been found.

  // And, a random search term to start if none was present on page load.
  $scope.searchTerm = $location.search().q || initChoices[idx];

  /**
   * A fresh search. Reset the scope variables to their defaults, set
   * the q query parameter, and load more results.
   */
  $scope.search = function() {
    $scope.page = 0;
    $scope.apis = [];
    $scope.allResults = false;
    $location.search({'q': $scope.searchTerm});
    $scope.loadMore();
  };

  /**
   * Load the next page of results, incrementing the page counter.
   * When query is finished, push results onto $scope.recipes and decide
   * whether all results have been returned (i.e. were 10 results returned?)
   */
  $scope.loadMore = function() {
    apis.search($scope.searchTerm, $scope.page++).then(function(results) {
      if (results.length !== 10) {
        $scope.allResults = true;
      }

      var ii = 0;

      for (; ii < results.length; ii++) {
        $scope.apis.push(results[ii]);
      }
    });
  };

  // Load results on first run
  $scope.loadMore();
}]);

app.controller('NewCtrl', [
'$scope',
'posts',
function($scope, posts){
  $scope.test = 'Hello world!';
  $scope.posts = posts.posts;

  $scope.addPost = function(){
    if(!$scope.title || $scope.title === '') { return; }
    posts.create({
      title: $scope.title,
      link: $scope.link
    });
    $scope.title = '';
    $scope.link = '';
  };
}]);

app.controller('ListingCtrl', [
'$scope',
'$http',
'posts',
function($scope, $http, posts){
  $scope.posts = posts.posts;
  angular.forEach(posts.posts, function(value,idx) {
    $http.get(value.link).then(function(res) {
      value['host'] = res.data.host;
      value['info'] = res.data.info.description;
    });
  });
}]);

app.directive('validSpec', function(isSpecValid) {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$asyncValidators.valid = isSpecValid;
    }
  };
});


app.directive('uniqueSpec', function(isSpecUnique) {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attrs, ngModel) {
      ngModel.$asyncValidators.unique = isSpecUnique;
    }
  };
});

app.factory('isSpecValid', function($q, $http) {
  return function(spec) {
    var deferred = $q.defer();

    SwaggerParser.validate(spec, function(err, api) {
      if (err) {
        console.log('Invalid API');
        deferred.reject();
      }
      else {
        console.log('Valid API');
        deferred.resolve();
      }
    });

    return deferred.promise;
  }
});

app.factory('isSpecUnique',['$q','$http', function($q, $http) {
  return function(spec) {
    var deferred = $q.defer();
    $http.get('/posts').then(function(data){
      p = { posts: [] };
      angular.copy(data, p.posts);
      console.log(p.posts);
      unique = [];
      angular.forEach(p.posts.data, function(value, key){
        if (value.link == spec) {
          console.log('Not unique');
          unique.push(value.link);
        }
      });

      $q.all(unique).then(function(data){
        if (data.length > 0) {
          deferred.reject();
        } else {
          deferred.resolve();
        }
      })
    });

    return deferred.promise;
  }
}]);

app.controller('PostsCtrl', [
'$scope',
'$http',
'post',
function($scope, $http, post){
  $scope.post = post;
  $scope.loadingSpec;
}]);

app.factory('apiService', ['$q', 'esFactory', '$location', function($q, elasticsearch, $location) {
  var client = elasticsearch({
    host: 'http://paas:f229eddf05b78e98535cceeaf53a21a5@dori-us-east-1.searchly.com'
  });

  var search = function(term, offset) {
    var deferred = $q.defer();
    var query = {
      match: {
        _all: term
      }
    };
    client.search({
      index: 'explore',
      type: 'api',
      body: {
        size: 10,
        from: (offset || 0) * 10,
        query: query
      }
    }).then(function(result) {
      var ii = 0, hits_in, hits_out = [];
      hits_in = (result.hits || {}).hits || [];
      for(; ii < hits_in.length; ii++) {
        hits_out.push(hits_in[ii]);
      }
      deferred.resolve(hits_out);
      console.log(hits_out);
    }, deferred.reject);
    return deferred.promise;
  };

  // Since this is a factory method, we return an object representing the actual service.
  return {
    search: search
  };
}]);
