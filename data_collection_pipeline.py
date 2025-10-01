#!/usr/bin/env python3
"""
Data Collection and Preprocessing Pipeline for Florida Fishing AI Model

This script handles the collection and preprocessing of various data sources
needed for the fishing spot prediction AI model, including weather data,
bathymetry, and other environmental factors.
"""

import os
import requests
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import time
from typing import Dict, List, Optional, Tuple
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

class WeatherDataCollector:
    """Collects weather data from Open-Meteo API"""
    
    def __init__(self):
        self.base_url = "https://api.open-meteo.com/v1/forecast"
        self.archive_url = "https://archive-api.open-meteo.com/v1/archive"
    
    def get_weather_data(self, lat: float, lon: float, date: datetime, is_historical: bool = False) -> Dict:
        """Get weather data for a location and date (current, forecast, or historical)"""
        url = self.archive_url if is_historical else self.base_url
        
        params = {
            'latitude': lat,
            'longitude': lon,
            'hourly': 'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,surface_pressure,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day',
            'daily': 'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant',
            'timezone': 'America/New_York',
            'start_date': date.strftime('%Y-%m-%d'),
            'end_date': date.strftime('%Y-%m-%d')
        }
        
        for attempt in range(3): # Retry up to 3 times
            try:
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                return response.json()
            except requests.exceptions.RequestException as e:
                logger.warning(f"Attempt {attempt+1} failed to fetch weather data from Open-Meteo: {e}")
                time.sleep(2 ** attempt) # Exponential backoff
        logger.error(f"Failed to fetch weather data from Open-Meteo after multiple attempts for {lat}, {lon}")
        return {}
    
    def process_weather_features(self, weather_data: Dict, target_datetime: datetime) -> Dict:
        """Extract relevant weather features for the AI model from Open-Meteo data"""
        features = {}
        
        if not weather_data or 'hourly' not in weather_data:
            return features
        
        hourly_data = weather_data['hourly']
        time_index = -1
        
        # Find the closest hourly data point to target_datetime
        for i, t_str in enumerate(hourly_data['time']):
            t = datetime.fromisoformat(t_str)
            if t.hour == target_datetime.hour:
                time_index = i
                break
        
        if time_index == -1:
            logger.warning(f"No hourly data found for {target_datetime.hour}:00")
            return features

        # Extract hourly features
        features.update({
            'temperature': hourly_data['temperature_2m'][time_index],
            'relative_humidity': hourly_data['relative_humidity_2m'][time_index],
            'surface_pressure': hourly_data['surface_pressure'][time_index],
            'cloud_cover': hourly_data['cloud_cover'][time_index],
            'precipitation': hourly_data['precipitation'][time_index],
            'rain': hourly_data['rain'][time_index],
            'uv_index': hourly_data['uv_index'][time_index],
            'wind_speed': hourly_data['wind_speed_10m'][time_index],
            'wind_direction': hourly_data['wind_direction_10m'][time_index],
            'is_day': hourly_data['is_day'][time_index]
        })
        
        # Extract daily features (e.g., max/min temp for the day)
        if 'daily' in weather_data:
            daily_data = weather_data['daily']
            features.update({
                'temp_max_daily': daily_data['temperature_2m_max'][0],
                'temp_min_daily': daily_data['temperature_2m_min'][0],
                'uv_index_max_daily': daily_data['uv_index_max'][0],
                'precipitation_sum_daily': daily_data['precipitation_sum'][0]
            })

        return features

class SolunarCalculator:
    """Calculates Solunar times based on sun and moon data"""
    
    @staticmethod
    def calculate_solunar_times(lat: float, lon: float, date: datetime) -> Dict:
        """Calculate major and minor Solunar feeding times"""
        # This is a simplified implementation
        # In a production system, you'd use an astronomical library like ephem or skyfield
        
        # For demonstration, we'll create mock Solunar times
        # In reality, these would be calculated based on moon transit times
        
        sunrise_hour = 7  # Simplified - would calculate actual sunrise
        sunset_hour = 19  # Simplified - would calculate actual sunset
        
        # Major times: typically around sunrise/sunset and moon transit
        major_times = [
            (sunrise_hour - 1, sunrise_hour + 1),  # Around sunrise
            (sunset_hour - 1, sunset_hour + 1)     # Around sunset
        ]
        
        # Minor times: typically around moonrise/moonset
        minor_times = [
            (13, 15),  # Afternoon minor time (example)
            (1, 3)     # Early morning minor time (example)
        ]
        
        return {
            'major_times': major_times,
            'minor_times': minor_times,
            'moon_phase': 'first_quarter',  # Would calculate actual phase
            'moon_illumination': 50  # Would calculate actual illumination
        }
    
    @staticmethod
    def is_solunar_time(current_hour: int, solunar_data: Dict) -> Dict:
        """Check if current time falls within Solunar feeding windows"""
        is_major = any(start <= current_hour <= end for start, end in solunar_data['major_times'])
        is_minor = any(start <= current_hour <= end for start, end in solunar_data['minor_times'])
        
        return {
            'is_major_time': is_major,
            'is_minor_time': is_minor,
            'is_solunar_time': is_major or is_minor
        }

class BathymetryProcessor:
    """Processes bathymetry and geographical data"""
    
    @staticmethod
    def load_fwc_bathymetry_data(file_path: str) -> pd.DataFrame:
        """Load FWC bathymetry data from downloaded files"""
        try:
            # Assuming the data is in CSV format
            df = pd.read_csv(file_path)
            logger.info(f"Loaded {len(df)} bathymetry records")
            return df
        except Exception as e:
            logger.error(f"Error loading bathymetry data: {e}")
            return pd.DataFrame()
    
    @staticmethod
    def calculate_depth_features(lat: float, lon: float, bathymetry_df: pd.DataFrame) -> Dict:
        """Calculate depth-related features for a given location"""
        if bathymetry_df.empty:
            return {'depth': 0, 'depth_variation': 0, 'near_dropoff': False, 'structure_present': False}
        
        # This is a simplified implementation
        # In practice, you'd use spatial queries to find nearby depth measurements
        
        # For demonstration, return mock depth features
        return {
            'depth': 15.5,  # Average depth in feet
            'depth_variation': 8.2,  # Variation in nearby depths
            'near_dropoff': True,  # Whether location is near a significant depth change
            'structure_present': True  # Whether fishing structures are present
        }

class FeatureEngineer:
    """Combines all data sources and creates features for the AI model"""
    
    def __init__(self, weather_collector: WeatherDataCollector):
        self.weather_collector = weather_collector
        self.solunar_calc = SolunarCalculator()
        self.bathymetry_processor = BathymetryProcessor()
    
    def create_features_for_location(self, lat: float, lon: float, 
                                   target_datetime: datetime,
                                   fish_species: str = 'largemouth_bass',
                                   bathymetry_df: Optional[pd.DataFrame] = None) -> Dict:
        """Create comprehensive feature set for a specific location and time"""
        
        features = {
            'latitude': lat,
            'longitude': lon,
            'fish_species': fish_species,
            'timestamp': target_datetime.isoformat()
        }
        
        # Weather features
        weather_data = self.weather_collector.get_weather_data(lat, lon, target_datetime)
        weather_features = self.weather_collector.process_weather_features(weather_data, target_datetime)
        features.update(weather_features)
        
        # Temporal features
        features.update({
            'hour': target_datetime.hour,
            'day_of_week': target_datetime.weekday(),
            'month': target_datetime.month,
            'season': self._get_season(target_datetime.month),
            'hour_sin': np.sin(2 * np.pi * target_datetime.hour / 24),
            'hour_cos': np.cos(2 * np.pi * target_datetime.hour / 24)
        })
        
        # Solunar features
        solunar_data = self.solunar_calc.calculate_solunar_times(lat, lon, target_datetime)
        solunar_features = self.solunar_calc.is_solunar_time(target_datetime.hour, solunar_data)
        features.update(solunar_features)
        features.update({
            'moon_phase': solunar_data['moon_phase'],
            'moon_illumination': solunar_data['moon_illumination']
        })
        
        # Bathymetry and geographical features
        if bathymetry_df is not None:
            depth_features = self.bathymetry_processor.calculate_depth_features(lat, lon, bathymetry_df)
            features.update(depth_features)
        
        # Bait recommendation features (based on temperature)
        features.update(self._get_bait_features(features.get('temperature', 70), fish_species))
        
        return features
    
    def _get_season(self, month: int) -> str:
        """Determine season based on month"""
        if month in [12, 1, 2]:
            return 'winter'
        elif month in [3, 4, 5]:
            return 'spring'
        elif month in [6, 7, 8]:
            return 'summer'
        else:
            return 'fall'
    
    def _get_bait_features(self, temperature: float, fish_species: str) -> Dict:
        """Get bait recommendations based on temperature and fish species"""
        # Simplified bait logic based on temperature
        # This would be expanded with more sophisticated rules
        
        bait_features = {}
        
        if fish_species == 'largemouth_bass':
            if temperature < 50:
                bait_features['recommended_bait'] = 'jig'
                bait_features['bait_category'] = 'slow_presentation'
            elif temperature < 65:
                bait_features['recommended_bait'] = 'spinnerbait'
                bait_features['bait_category'] = 'medium_presentation'
            elif temperature < 80:
                bait_features['recommended_bait'] = 'topwater'
                bait_features['bait_category'] = 'fast_presentation'
            else:
                bait_features['recommended_bait'] = 'deep_crankbait'
                bait_features['bait_category'] = 'deep_presentation'
        
        return bait_features

class DataPipeline:
    """Main data pipeline orchestrator"""
    
    def __init__(self):
        self.weather_collector = WeatherDataCollector()
        self.feature_engineer = FeatureEngineer(self.weather_collector)
        self.data_cache = {}
    
    def collect_training_data(self, locations: List[Tuple[float, float, str]], 
                            date_range: Tuple[datetime, datetime],
                            fish_species: str = 'largemouth_bass') -> pd.DataFrame:
        """Collect training data for multiple locations and time periods"""
        
        training_data = []
        start_date, end_date = date_range
        
        for lat, lon, name in locations:
            logger.info(f"Collecting data for location: {name} ({lat}, {lon})")
            
            current_date = start_date
            while current_date <= end_date:
                try:
                    features = self.feature_engineer.create_features_for_location(
                        lat, lon, current_date, fish_species
                    )
                    
                    # Add mock fishing success data (in real implementation, this would come from historical records)
                    features['fishing_success'] = np.random.random()  # Mock target variable
                    features['catch_count'] = np.random.poisson(2)    # Mock catch count
                    
                    training_data.append(features)
                    
                    # Move to next time period (e.g., every 6 hours)
                    current_date += timedelta(hours=6)
                    
                    # Rate limiting
                    time.sleep(0.1)
                    
                except Exception as e:
                    logger.error(f"Error collecting data for {name} ({lat}, {lon}) at {current_date}: {e}")
                    continue
        
        df = pd.DataFrame(training_data)
        logger.info(f"Collected {len(df)} training samples")
        return df
    
    def save_data(self, df: pd.DataFrame, filename: str):
        """Save collected data to file"""
        os.makedirs(os.path.dirname(filename), exist_ok=True)
        df.to_csv(filename, index=False)
        logger.info(f"Data saved to {filename}")

def main():
    """Main function to demonstrate the data collection pipeline"""
    
    # Use locations from config.py
    from config import FLORIDA_FISHING_LOCATIONS, DATA_PATHS
    
    # Initialize pipeline
    pipeline = DataPipeline()
    
    # Define date range for training data
    start_date = datetime.now() - timedelta(days=7) # Collect for past 7 days for demonstration
    end_date = datetime.now()
    
    # Collect training data
    logger.info("Starting data collection...")
    training_df = pipeline.collect_training_data(
        locations=FLORIDA_FISHING_LOCATIONS,
        date_range=(start_date, end_date),
        fish_species='largemouth_bass'
    )
    
    # Save training data
    pipeline.save_data(training_df, DATA_PATHS['training_data'])
    
    # Display sample of collected data
    print("\nSample of collected data:")
    print(training_df.head())
    print(f"\nTotal features: {len(training_df.columns)}")
    print(f"Total samples: {len(training_df)}")

if __name__ == "__main__":
    main()
