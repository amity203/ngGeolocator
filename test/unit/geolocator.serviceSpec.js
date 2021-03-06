describe('ngGeolocator', function() {
  'use strict';
  beforeEach(module('ngGeolocator'));

  describe('service', function() {
    var service, $window, $rootScope, $timeout;
    beforeEach(inject(function(ngGeolocator, _$window_, _$rootScope_, _$timeout_) {
      service = ngGeolocator;
      $window = _$window_;
      $rootScope = _$rootScope_;
      $timeout = _$timeout_;
      $window.document.body.appendChild = jasmine.createSpy('appendChild');
      $window.document.getElementById = jasmine.createSpy('getElementById');
      $window.navigator.geolocation = {
        getCurrentPosition: jasmine.createSpy('getCurrentPosition'),
      };
      $window.google = {
        maps: {
          Map: jasmine.createSpy('maps.Map').and.returnValue({
            setCenter: jasmine.createSpy('maps.Map.setCenter'),
          }),
          LatLng: jasmine.createSpy('maps.LatLng'),
          Size: jasmine.createSpy('maps.Size'),
          Point: jasmine.createSpy('maps.Point'),
          InfoWindow: jasmine.createSpy('maps.InfoWindow').and.returnValue({
            setMap: jasmine.createSpy('maps.InfoWindow.setMap'),
          }),
          Marker: jasmine.createSpy('maps.Marker').and.returnValue({
            setMap: jasmine.createSpy('maps.Marker.setMap'),
          }),
          Circle: jasmine.createSpy('maps.Circle').and.returnValue({
            setMap: jasmine.createSpy('maps.Circle.setMap'),
          }),
        },
      };
    }));

    function callMapsCallback() {
      var callback = /callback=([^&]*)/.exec($window.document.body.appendChild.calls.first().args[0].src)[1];
      $window[callback]();
    }

    describe('create', function() {
      describe('loading the Google Maps API', function() {
        var appendChild;
        beforeEach(function() {
          appendChild = $window.document.body.appendChild;
        });

        it('add the google maps API script to body', function() {
          service.create();
          expect(appendChild).toHaveBeenCalled();
          expect(appendChild.calls.first().args[0].src).toMatch('maps.googleapis.com/maps/api/js');
        });

        it('should include the key, if added', function() {
          service.create('', 'a-test-key');
          expect(appendChild.calls.first().args[0].src).toMatch('key=a-test-key');
        });

        describe('with API initialized', function() {
          var locatorPromise;
          beforeEach(function() {
            locatorPromise = service.create('canvas-id');
            callMapsCallback();
          });

          it('should create the map on the specified canvas', function() {
            var mockElement = 'mockElement';
            $window.document.getElementById.and.returnValue(mockElement);

            $rootScope.$apply();

            expect($window.document.getElementById).toHaveBeenCalledWith('canvas-id');
            expect($window.google.maps.Map).toHaveBeenCalled();
            var args = $window.google.maps.Map.calls.first().args;
            expect(args[0]).toBe(mockElement);
            expect(args[1].zoom).toBeDefined();
          });
        });
      });

      describe('getting the user\'s location', function() {
        describe('with no geolocation service available', function() {
          beforeEach(function() {
            delete $window.navigator.geolocation;
          });

          it('should fail', function(done) {
            service.create().catch(function() {
              done();
            });
            $rootScope.$apply();
          }, 500);

          describe('with the map already created', function() {
            itShouldCreateFailureInfoWindow();
          });
        });

        describe('with geolocation service available', function() {
          describe('with timeout reached without user responding', function() {
            it('should fail', function(done) {
              service.create().catch(function() {
                done();
              });
              $timeout.flush();
              $rootScope.$apply();
            }, 500);

            describe('with the map already created', function() {
              itShouldCreateFailureInfoWindow(function() {
                $timeout.flush();
              });
            });
          });
        });

        function itShouldCreateFailureInfoWindow(f) {
          describe('failure InfoWindow', function() {
            var locatorPromise, setMap, map, setCenter;
            beforeEach(function() {
              locatorPromise = service.create();
              callMapsCallback();
              setMap = $window.google.maps.InfoWindow().setMap;
              $window.google.maps.InfoWindow.calls.reset();
              setCenter = jasmine.createSpy('Map.setCenter');
              map = {
                setCenter: setCenter,
              };
              $window.google.maps.Map.and.returnValue(map);
            });

            it('should fail and create an info window on the map', function() {
              if (f) {
                f();
              }
              $rootScope.$apply();

              expect($window.google.maps.InfoWindow).toHaveBeenCalled();
              expect(setMap).toHaveBeenCalledWith(map);
              expect(setCenter).toHaveBeenCalled();
            });
          });
        }
      });

      describe('creating the locator, with maps initialized and location available', function() {
        var locatorPromise, position;
        beforeEach(function() {
          locatorPromise = service.create();
          callMapsCallback();
          position = {
            coords: {
              latitude: 10,
              longitude: 20,
              accuracy: 30,
            },
          };
          $window.navigator.geolocation.getCurrentPosition.calls.first().args[0](position);
        });

        it('should resolve the promise with a locator, that has the location of the marker', function() {
          var locator;
          locatorPromise.then(function(l) {
            locator = l;
          });
          var getPosition = jasmine.createSpy('getPosition').and.returnValue({
            lat: function() {
              return 10;
            },
            lng: function() {
              return 20;
            },
          });
          $window.google.maps.Marker.and.returnValue({
            setMap: $window.google.maps.Marker().setMap,
            getPosition: getPosition,
          });

          $rootScope.$apply();

          expect($window.google.maps.LatLng).toHaveBeenCalledWith(10, 20);
          expect($window.google.maps.Circle).toHaveBeenCalled();
          expect($window.google.maps.Circle.calls.first().args[0].radius).toEqual(30);
          var position = locator.getLocation();
          expect(position.lat).toEqual(10);
          expect(position.lng).toEqual(20);
        });
      });
    });
  });
});
