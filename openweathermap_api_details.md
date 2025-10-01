# OpenWeatherMap API Details

OpenWeatherMap offers various APIs that can provide the necessary weather data for the AI fishing prediction model. Key APIs and their relevance:

## One Call API 3.0
*   **Current weather and forecasts:** Minute forecast for 1 hour, hourly forecast for 48 hours, daily forecast for 8 days, and government weather alerts.
*   **Weather data for any timestamp:** 46+ years historical archive and 4 days ahead forecast.
*   **Daily aggregation:** Daily aggregation of weather data for 46+ years archive and 1.5 years ahead forecast.

## Current & Forecast weather data collection
*   **Current Weather Data:** Access current weather data for any location (JSON, XML, HTML formats). Included in both free and paid subscriptions.
*   **Hourly Forecast 4 days:** Hourly forecast for 4 days (96 timestamps). Included in Developer, Professional, and Expert subscription plans.
*   **Daily Forecast 16 days:** 16 days forecast for any location. Included in all paid subscription plans.
*   **Climatic Forecast 30 days:** Forecast weather data for 30 days. Included in Developer, Professional, and Expert subscription plans.

## Historical weather data collection
*   **History API:** Historical weather data for any location with 1-hour step. Available in Professional and Expert subscription plans.
*   **History Bulk:** Weather data for 46+ years back (from January 01, 1979). Available through Marketplace.

**Variables available:** Temperature, Wind, Pressure, Humidity, Cloudcover, Rain Precipitation. UV Index is available through the Solar Irradiance API.

**Considerations:**
*   The free tier offers 1,000 API calls per day for the One Call API 3.0.
*   Historical data and longer-range forecasts often require paid subscriptions (Professional or Expert plans).
