'use strict';

////////////////////////////////////////////

const inputDistance = document.querySelector('.form__input--distance');
const inputDirection = document.querySelector('.form__input--direction');
const inputType = document.querySelector('.form__input--type');
const inputDuration = document.querySelector('.form__input--duration');
const form = document.querySelector('.form');
const workoutsContainer = document.querySelector('.workouts');
const messageSuccess = document.querySelector('.message__complete');
const messageFail = document.querySelector('.message__error');
const btnShowAllWork = document.querySelector('.control__btn--show');
const btnHideAllWork = document.querySelector('.control__btn--hide');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  type;
  completed = false;
  routeDisplayed = false;
  constructor(start, end, distance, duration, route) {
    this.startPoint = start;
    this.endPoint = end;
    this.distance = distance;
    this.duration = duration;
    this.route = route;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(start, end, distance, duration, route) {
    super(start, end, distance, duration, route);
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(start, end, distance, duration, route) {
    super(start, end, distance, duration, route);
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

class App {
  #currposition = {};
  #initMarker;
  #workouts = [];
  #map;
  #route;
  #firstPoint;
  #lastPoint;
  constructor() {
    this._getUserLocation();
    this._getLocalStorage();

    form.addEventListener('submit', this._newWorkout.bind(this));
    workoutsContainer.addEventListener('click', this._completeCheck.bind(this));
    btnShowAllWork.addEventListener(
      'click',
      this._displayAllWorkouts.bind(this, this.#workouts)
    );
    btnHideAllWork.addEventListener('click', this._hideAllWorkouts.bind(this));
  }

  #calculateDestinationLatLon(lat1, lon1, distance, bearing) {
    const R = 6371.01;
    // Convert latitude and longitude from degrees to radians
    const lat1Rad = this.#degreesToRadians(lat1);
    const lon1Rad = this.#degreesToRadians(lon1);

    // Convert distance to angular distance in radians
    const angularDistance = distance / R;

    // Convert bearing to radians
    const bearingRad = this.#degreesToRadians(bearing);

    // Calculate the new latitude
    const lat2Rad = Math.asin(
      Math.sin(lat1Rad) * Math.cos(angularDistance) +
        Math.cos(lat1Rad) * Math.sin(angularDistance) * Math.cos(bearingRad)
    );

    // Calculate the new longitude
    const lon2Rad =
      lon1Rad +
      Math.atan2(
        Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(lat1Rad),
        Math.cos(angularDistance) - Math.sin(lat1Rad) * Math.sin(lat2Rad)
      );

    // Convert the new latitude and longitude back to degrees
    const lat2 = this.#radiansToDegrees(lat2Rad);
    const lon2 = this.#radiansToDegrees(lon2Rad);

    // Normalize lon2 to be within the range -180 to 180 degrees
    const lon2Normalized = ((lon2 + 540) % 360) - 180;

    // Return the new coordinates
    return { latitude: lat2, longitude: lon2Normalized };
  }

  // Helper functions to convert degrees to radians and radians to degrees
  #degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  #radiansToDegrees(radians) {
    return (radians * 180) / Math.PI;
  }

  #calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180); // Convert degrees to radians
    const dLng = (lng2 - lng1) * (Math.PI / 180);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    const distance = R * c; // Distance in kilometers
    return distance * 1000;
  }

  _hideAllWorkouts() {
    this.#workouts.forEach(work => {
      if (work.completed && work.route) {
        work.route.remove();
        work.route = null;
        work.routeDisplayed = false;
      }
    });
  }

  _displayAllWorkouts(workouts) {
    if (this.#map) {
      workouts.forEach(work => {
        if (work.completed && !work.routeDisplayed) {
          work.routeDisplayed = true;
          work.route = L.Routing.control({
            waypoints: [
              L.latLng(work.startPoint.lat, work.startPoint.lng),
              L.latLng(work.endPoint.lat, work.endPoint.lng),
            ],
            routeWhileDragging: false,
            draggableWaypoints: false,
            addWaypoints: false,
            lineOptions: {
              styles: [{ color: 'green', opacity: 1, weight: 5 }], // Initially hidden route
            },
          }).addTo(this.#map);
        }
      });
    }
  }

  _getUserLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(this._loadMap.bind(this), () =>
        alert('Position was blocked')
      );
    }
  }

  _loadMap(position) {
    ({ latitude: this.#currposition.lat } = position.coords);
    ({ longitude: this.#currposition.lng } = position.coords);

    // Fake data
    // mid {lat: 30.95800309529504, lng: 29.537807466695092}
    // { lat: 30.976299206626877, lng: 29.57162476319354 } coast
    // { lat: 30.049259284104355, lng: 31.232843399047855 } cairo
    // ({ lat: this.#currposition.lat, lng: this.#currposition.lng } = {
    //   lat: 30.049259284104355,
    //   lng: 31.232843399047855,
    // });
    console.log(this.#currposition);
    if (!this.#map) {
      this.#map = L.map('map').setView(
        [this.#currposition.lat, this.#currposition.lng],
        13
      );

      L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(this.#map);
      this._showForm();
    }

    if (this.#initMarker) this.#initMarker.remove();

    this.#initMarker = L.marker([
      this.#currposition.lat,
      this.#currposition.lng,
    ]);

    this.#initMarker
      .addTo(this.#map)
      .bindPopup('your current position! 🧍‍♂️')
      .openPopup();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = '';

    form.style.display = 'none';
    form.classList.add('form__hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _showForm() {
    form.classList.remove('form__hidden');
    inputDistance.focus();
  }

  _setMarkerIcon() {
    const startIcon = L.icon({
      iconUrl: 'media/sign.png',
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -44],
    });

    const endIcon = L.icon({
      iconUrl: 'media/end.png',
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -44],
    });

    return [startIcon, endIcon];
  }

  #validateInputs(...inputs) {
    return inputs.every(input => Number.isFinite(input) && input > 0);
  }

  _newWorkout(e) {
    e.preventDefault();

    const workoutData = {
      distance: +inputDistance.value,
      direction: +inputDirection.value,
      type: inputType.value,
      duration: +inputDuration.value,
      start: { lat: undefined, lng: undefined },
      end: { lat: undefined, lng: undefined },
    };
    let workout;

    if (!this.#validateInputs(workoutData.distance, workoutData.duration))
      return alert('invalid values!');

    this.#initMarker.remove();

    // render initial route
    this._renderInitialRoute(workoutData);
  }

  _renderInitialRoute(workoutData) {
    const { latitude: newLat, longitude: newLng } =
      this.#calculateDestinationLatLon(
        this.#currposition.lat,
        this.#currposition.lng,
        workoutData.distance,
        workoutData.direction
      );

    const initialRoute = L.Routing.control({
      waypoints: [
        L.latLng(this.#currposition.lat, this.#currposition.lng),
        L.latLng(newLat, newLng),
      ],
      routeWhileDragging: false,
      draggableWaypoints: false,
      addWaypoints: false,
      lineOptions: {
        styles: [{ color: 'blue', opacity: 1, weight: 5 }],
      },
    }).addTo(this.#map);
    initialRoute.distance = workoutData.distance;
    initialRoute.duration = workoutData.duration;
    initialRoute.on(
      'routesfound',
      this._renderFinalRoute.bind(this, initialRoute, workoutData)
    );
  }

  _renderFinalRoute(initialRoute, workoutData, routeEV) {
    let totalDistance = 0;
    const latLngs = routeEV.routes[0].coordinates;
    let targetPoint = null;
    let currentPoint = latLngs[0];

    for (let i = 1; i < latLngs.length; i++) {
      const nextPoint = latLngs[i];
      const distanceToNext = currentPoint.distanceTo(nextPoint) / 1000;
      totalDistance += distanceToNext;

      // Check if we've reached the specified distance
      if (totalDistance >= initialRoute.distance) {
        targetPoint = nextPoint;
        break;
      }
      currentPoint = nextPoint;
    }

    // Add a new route with updated waypoints and visible line style
    const [startIcon, endIcon] = this._setMarkerIcon();
    const finalRoute = L.Routing.control({
      waypoints: [
        L.latLng(this.#currposition.lat, this.#currposition.lng),
        L.latLng(targetPoint.lat, targetPoint.lng),
      ],
      routeWhileDragging: false,
      draggableWaypoints: false,
      addWaypoints: false,
      createMarker: function (i, waypoint, n) {
        if (i === 0) {
          return L.marker(waypoint.latLng, { icon: startIcon })
            .bindPopup('Start Point 😁😇')
            .openPopup();
        }
        if (i === n - 1) {
          return L.marker(waypoint.latLng, { icon: endIcon })
            .bindPopup('End Point 😩🥵')
            .openPopup();
        }
      },
      lineOptions: {
        styles: [{ color: 'blue', opacity: 1, weight: 5 }],
      },
    }).addTo(this.#map);

    // remove initail route after completing the adjusted version
    finalRoute.on('routesfound', () => initialRoute.remove());
    console.log(finalRoute);
    // The workout start & end points
    workoutData.start.lat = this.#currposition.lat;
    workoutData.start.lng = this.#currposition.lng;
    workoutData.end.lat = targetPoint.lat;
    workoutData.end.lng = targetPoint.lng;
    workoutData.route = finalRoute;
    this._createWorkout(workoutData);
  }

  _createWorkout(workoutData) {
    const workout =
      workoutData.type === 'running'
        ? new Running(
            workoutData.start,
            workoutData.end,
            workoutData.distance,
            workoutData.duration,
            workoutData.route
          )
        : new Cycling(
            workoutData.start,
            workoutData.end,
            workoutData.distance,
            workoutData.duration,
            workoutData.route
          );
    this.#workouts.push(workout);

    this._renderWorkout(workout);
  }

  _renderWorkout(workout) {
    if (this.#initMarker) this.#initMarker.remove();
    let html = `
        <li class="workout ${
          workout.completed ? 'workout--complete' : ''
        } workout--running" data-id="${workout.id}">
            <h2 class="workout__title">${workout.description}</h2>
            <div class="workout__details">
              <span class="workout__icon">${
                workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'
              }</span>
              <span class="workout__value">${workout.distance}</span>
              <span class="workout__unit">km</span>
            </div>
            <div class="workout__details">
              <span class="workout__icon">⏱</span>
              <span class="workout__value">${workout.duration}</span>
              <span class="workout__unit">min</span>
            </div>
    `;

    if (workout.type === 'running') {
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.pace.toFixed(1)}</span>
              <span class="workout__unit">min/km</span>
            </div>
            <button class="workout__btn">${
              workout.completed ? 'completed' : 'complete?'
            }</button>
          </li>
      `;
    }
    if (workout.type === 'cycling') {
      html += `
            <div class="workout__details">
              <span class="workout__icon">⚡️</span>
              <span class="workout__value">${workout.speed.toFixed(1)}</span>
              <span class="workout__unit">km/h</span>
            </div>
            <button class="workout__btn">${
              workout.completed ? 'completed' : 'complete?'
            }</button>
          </li>
      `;
    }
    form.insertAdjacentHTML('afterend', html);
    this._hideForm();
  }

  _completeCheck(e) {
    let workoutEl;
    let workout;

    if (e.target.closest('.workout')) {
      workoutEl = e.target.closest('.workout');

      if (e.target.classList.contains('workout__btn')) {
        workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
        this._getUserLocation();
        const distance = this.#calculateDistance(
          this.#currposition.lat,
          this.#currposition.lng,
          workout.endPoint.lat,
          workout.endPoint.lng
        );
        if (distance <= 50) {
          this.#initMarker.remove();
          messageSuccess.classList.remove('message--hidden');
          setTimeout(() => {
            messageSuccess.classList.add('message--hidden');
          }, 2000);
          e.target.textContent = 'completed';
          workoutEl.classList.add('workout--complete');
          workout.completed = true;
          this._showForm();
          this._hideAllWorkouts();
          this._setLocalStorage();
        } else {
          messageFail.classList.remove('message--hidden');
          setTimeout(() => {
            messageFail.classList.add('message--hidden');
          }, 3000);
        }
      } else {
        if (workoutEl.classList.contains('workout--complete')) {
          workout = this.#workouts.find(
            work => work.id === workoutEl.dataset.id
          );
          this._displayAllWorkouts([workout]);
        }
      }
    }
  }

  _setLocalStorage() {
    localStorage.setItem('myWorkouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('myWorkouts'));

    if (!data) return;
    this.#workouts = data;

    this.#workouts.forEach(work => this._renderWorkout(work));
  }
}

const app = new App();
