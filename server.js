"use strict";

// Require dependencies.
const express = require("express");
const fetch = require("node-fetch");
//const cors = require("cors");
const path = require("path");

// Use dotenv package to import API key from .env file.
require("dotenv").config();
const apiKey = `${process.env.API_KEY}`;

// Create express app.
const app = express();
const port = 5500;
//app.use(express.static("public"));
let publicPath = path.resolve(__dirname, "public");
// console.log(publicPath);
app.use(express.static(publicPath));
//app.use(cors());

// Register routes.
app.get("/", (req, res) => {
  res.status(200).send("WheatherMan running...");
});
app.get("/weather/", (req, res) => {
  res.status(400).json({ error: "Bad Request." });
});
app.get("/weather/:city", getForecast);

// Start the server.
app.listen(port, () => console.log(`Listening on port ${port}...`));

// Get the forecast to return to the client.
async function getForecast(req, res) {
  let city = req.params.city;
  console.log(`Request received for ${city}.`);
  try {
    const coords = await getCoordinates(city);

    const fourDayWeatherForecast = await get4DayWeatherForecast(coords);
    const fiveDayAirPollutionForecast = await get5DayAirPollutionForecast(
      coords
    );

    let forecast = {
      weather: fourDayWeatherForecast,
      airPollution: fiveDayAirPollutionForecast,
    };
    res.status(200).json(forecast);
  } catch (e) {
    res.status(400).json({ error: "Bad Request." });
  }
}

// Get coordinates of given city using OpenWeather Geocoder API.
async function getCoordinates(city) {
  const response = await fetch(
    `http://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();
  return [data[0].lat, data[0].lon];
}

// Get simplified 4-day weather forecast.
async function get4DayWeatherForecast(coords) {
  const weatherForecast = await get5Day3HourWeatherForecast(coords);
  // console.log(weatherForecast);
  let weatherData = [];
  let previousTime = weatherForecast[0].time;

  let index = 0;
  console.log(
    "Number of weather forecast entries: ",
    Object.keys(weatherForecast).length
  );
  while (index < Object.keys(weatherForecast).length) {
    console.log(`index: ${index}`);
    let sameDate = true;
    let temperatureSum = 0;
    let windSpeedSum = 0;
    let rainfallLevelSum = 0;
    let count = 0;
    let rainfallLevelCount = 0;
    let currentTime = 0;
    while (sameDate && index + count < Object.keys(weatherForecast).length) {
      //console.log(`weatherForecast[${index}]: ${weatherForecast[index].time}`);
      let interval = weatherForecast[index + count];
      currentTime = interval.time;
      //console.log(`PreviousDate: ${new Date(previousTime * 1000)}`);
      //console.log(`CurrentDate: ${new Date(currentTime * 1000)}`);
      if (isSameDate(previousTime, currentTime)) {
        //console.log(`Same Dates`);
        console.log(`Day of Week: ${getDayOfWeek(currentTime)}`);
        console.log(`temp: ${interval.temperature}`);
        console.log(`ws: ${interval.windSpeed}`);
        console.log(`rl: ${interval.rainfallLevel}`);
        temperatureSum += interval.temperature;
        windSpeedSum += interval.windSpeed;
        if (interval.rainfallLevel !== undefined) {
          rainfallLevelSum += interval.rainfallLevel;
          rainfallLevelCount++;
        }
        count++;
      } else {
        //console.log(`Different Dates`);
        sameDate = false;
      }
      //console.log(`Inner Count: ${count}`);
      //console.log(`Inner Index: ${index}`);
    }
    //console.log(`Day of Week: ${getDayOfWeek(previousTime)}`);
    console.log(`Sum temp: ${temperatureSum}`);
    console.log(`Sum ws: ${windSpeedSum}`);
    console.log(`Sum rl: ${rainfallLevelSum}`);
    console.log(
      `index: ${index} count:${count} rainfallLevelCount: ${rainfallLevelCount}`
    );
    console.log(`Average temp: ${temperatureSum / count}`);
    console.log(`Average ws: ${windSpeedSum / count}`);
    console.log(`Average rl: ${rainfallLevelSum / rainfallLevelCount}`);
    weatherData.push({
      day: getDayOfWeek(previousTime),
      temperature:
        Math.round(convertKelvinToCelcius(temperatureSum / count) * 100) / 100,
      windSpeed: Math.round((windSpeedSum / count) * 100) / 100,
      rainfallLevel:
        Math.round((rainfallLevelSum / rainfallLevelCount) * 100) / 100,
    });
    console.log(`length: ${Object.keys(weatherData).length}\n`);
    previousTime = currentTime;
    index += count;
  }
  console.log("WeatherData: ", weatherData);
  return weatherForecast;
}

// Get 5-day weather forecast in 3-hour increments using OpenWeather 5-Day/3-Hour Forecast API.
async function get5Day3HourWeatherForecast(coords) {
  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/forecast?lat=${coords[0]}&lon=${coords[1]}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();

  let weatherData = [];
  Object.keys(data.list).forEach(function (index) {
    let interval = data.list[index];
    let rainfallLevel = interval.rain;
    if (rainfallLevel !== undefined) {
      rainfallLevel = interval.rain["3h"];
    }
    weatherData.push({
      time: interval.dt,
      temperature: interval.main.temp,
      windSpeed: interval.wind.speed,
      rainfallLevel: rainfallLevel,
    });
  });
  return weatherData;
}

// Convert from Kelvin to degrees Celcius.
function convertKelvinToCelcius(kelvin) {
  return kelvin - 273.15;
}

// Get simplified 5-day air pollution forecast.
async function get5DayAirPollutionForecast(coords) {
  const airPollutionForecast = await get5Day1HourAirPollutionForecast(coords);

  let airPollutionData = [];
  let previousTime = airPollutionForecast[0].time;
  let index = 0;
  console.log(
    "Number of air pollution entries: ",
    Object.keys(airPollutionForecast).length
  );
  while (index < Object.keys(airPollutionForecast).length) {
    console.log(`index: ${index}`);
    let sameDate = true;
    let pm2_5Sum = 0;
    let pm2_5Max = 0;
    let count = 0;
    let currentTime = 0;
    while (
      sameDate &&
      index + count < Object.keys(airPollutionForecast).length
    ) {
      //console.log(`airPollution[${index}]: ${airPollution[index].time}`);
      let interval = airPollutionForecast[index + count];
      currentTime = interval.time;
      //console.log(`PreviousDate: ${new Date(previousTime * 1000)}`);
      //console.log(`CurrentDate: ${new Date(currentTime * 1000)}`);
      if (isSameDate(previousTime, currentTime)) {
        //console.log(`Same Dates`);
        console.log(`Day of Week: ${getDayOfWeek(currentTime)}`);
        console.log(`pm2_5: ${interval.pm2_5}`);
        pm2_5Sum += interval.pm2_5;
        pm2_5Max = pm2_5Max < interval.pm2_5 ? interval.pm2_5 : pm2_5Max;
        count++;
      } else {
        //console.log(`Different Dates`);
        sameDate = false;
      }
      //console.log(`Inner Count: ${count}`);
      //console.log(`Inner Index: ${index}`);
    }
    //console.log(`Day of Week: ${getDayOfWeek(previousTime)}`);
    console.log(`Sum pm2_5: ${pm2_5Sum}`);
    console.log(`index: ${index} count:${count}`);
    console.log(`Average pm2_5: ${pm2_5Sum / count}`);
    airPollutionData.push({
      day: getDayOfWeek(previousTime),
      pm2_5: Math.round((pm2_5Sum / count) * 100) / 100,
      max_pm2_5: pm2_5Max,
    });
    console.log(`length: ${Object.keys(airPollutionData).length}\n`);
    previousTime = currentTime;
    index += count;
  }
  console.log("AirPollutionData: ", airPollutionData);
  return airPollutionData;
}

// Get 5-day air pollution forecast in 1-hour increments using OpenWeather Air Pollution API.
async function get5Day1HourAirPollutionForecast(coords) {
  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${coords[0]}&lon=${coords[1]}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();
  let airPollutionData = [];
  Object.keys(data.list).forEach(function (index) {
    let interval = data.list[index];
    airPollutionData.push({
      time: interval.dt,
      pm2_5: interval.components.pm2_5,
    });
  });
  return airPollutionData;
}

// Check whether two UNIX timestamps are the same date.
function isSameDate(time1, time2) {
  let date1 = new Date(time1 * 1000);
  let date2 = new Date(time2 * 1000);
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  );
}

// Get day of week from UNIX timestamp
function getDayOfWeek(time) {
  let day = "";
  let date = new Date(time * 1000);
  switch (date.getDay()) {
    case 0:
      day = "Sunday";
      break;
    case 1:
      day = "Monday";
      break;
    case 2:
      day = "Tuesday";
      break;
    case 3:
      day = "Wednesday";
      break;
    case 4:
      day = "Thursday";
      break;
    case 5:
      day = "Friday";
      break;
    case 6:
      day = "Saturday";
      break;
  }
  return day;
}
