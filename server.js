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

async function getCoordinates(city) {
  const response = await fetch(
    `http://api.openweathermap.org/geo/1.0/direct?q=${city}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();
  return [data[0].lat, data[0].lon];
}

async function get4DayWeatherForecast(coords) {
  const forecast = await get5Day3HourForecast(coords);
  let weatherData = [];
  Object.keys(forecast.list).forEach(function (index) {
    let interval = forecast.list[index];
    let rainfallLevel = interval.rain;
    if (rainfallLevel !== undefined) {
      rainfallLevel = interval.rain["3h"];
    }
    weatherData.push({
      time: interval.dt,
      weatherDescription: interval.weather.main,
      temperature: interval.main.temp,
      windSpeed: interval.wind.speed,
      rainfallLevel: rainfallLevel,
    });
  });
  return weatherData;
}

async function get5Day3HourForecast(coords) {
  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/forecast?lat=${coords[0]}&lon=${coords[1]}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();
  return data;
}

async function get5DayAirPollutionForecast(coords) {
  const airPollution = await getAirPollution(coords);

  let airPollutionData = [];
  Object.keys(airPollution.list).forEach(function (index) {
    let interval = airPollution.list[index];
    airPollutionData.push({
      time: interval.dt,
      pm2_5: interval.components.pm2_5,
    });
  });
}

async function getAirPollution(coords) {
  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/air_pollution/forecast?lat=${coords[0]}&lon=${coords[1]}&appid=${process.env.API_KEY}`
  );
  const data = await response.json();
  return data;
}
