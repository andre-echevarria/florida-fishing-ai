#!/usr/bin/env python3
"""
Flask API Backend for Florida Fishing AI

This script provides a REST API for the fishing prediction system,
allowing the React frontend to communicate with the ML model.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import os
import sys

# Add current directory to path to import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from fishing_model import FishingPredictor
from data_collection_pipeline import WeatherDataCollector, FeatureEngineer
from config import FLORIDA_FISHING_LOCATIONS, FISH_SPECIES

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Global variables for model and data collectors
predictor = None
weather_collector = None
feature_engineer = None

def initialize_services():
    """Initialize the prediction services"""
    global predictor, weather_collector, feature_engineer
    
    try:
        # Initialize predictor and load model
        predictor = FishingPredictor()
        if os.path.exists('models/fishing_predictor.joblib'):
            predictor.load_model('models/fishing_predictor.joblib')
            logger.info("Model loaded successfully")
        else:
            logger.warning("No trained model found. Please train the model first.")
        
        # Initialize weather collector and feature engineer
        weather_collector = WeatherDataCollector()
        feature_engineer = FeatureEngineer(weather_collector)
        
        logger.info("Services initialized successfully")
        
    except Exception as e:
        logger.error(f"Error initializing services: {e}")

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'model_loaded': predictor is not None and predictor.model is not None
    })

@app.route('/api/locations', methods=['GET'])
def get_locations():
    """Get available fishing locations"""
    locations = [
        {
            'id': i,
            'name': location[2],
            'latitude': location[0],
            'longitude': location[1]
        }
        for i, location in enumerate(FLORIDA_FISHING_LOCATIONS)
    ]
    return jsonify(locations)

@app.route('/api/fish-species', methods=['GET'])
def get_fish_species():
    """Get available fish species"""
    species = [
        {
            'id': key,
            'name': value['name'],
            'optimal_temp_range': value['optimal_temp_range']
        }
        for key, value in FISH_SPECIES.items()
    ]
    return jsonify(species)

@app.route('/api/predict', methods=['POST'])
def predict_fishing():
    """Main prediction endpoint"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['latitude', 'longitude', 'fish_species']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Extract parameters
        lat = float(data['latitude'])
        lon = float(data['longitude'])
        fish_species = data['fish_species']
        target_datetime = datetime.now()
        
        # Parse datetime if provided
        if 'datetime' in data:
            try:
                target_datetime = datetime.fromisoformat(data['datetime'])
            except ValueError:
                return jsonify({'error': 'Invalid datetime format'}), 400
        
        # Check if model is loaded
        if predictor is None or predictor.model is None:
            return jsonify({'error': 'Prediction model not available'}), 503
        
        # Generate features for the location and time
        features = feature_engineer.create_features_for_location(
            lat, lon, target_datetime, fish_species
        )
        
        if not features:
            return jsonify({'error': 'Unable to generate features for prediction'}), 500
        
        # Make prediction
        prediction_result = predictor.predict_fishing_success(features)
        recommendations = predictor.get_recommendations(features, prediction_result)
        
        # Prepare response
        response = {
            'prediction': {
                'fishing_success_score': float(prediction_result['fishing_success_score']),
                'confidence': float(prediction_result['confidence']),
                'timestamp': target_datetime.isoformat()
            },
            'recommendations': recommendations,
            'location': {
                'latitude': lat,
                'longitude': lon
            },
            'weather': {
                'temperature': features.get('temperature'),
                'humidity': features.get('relative_humidity'),
                'pressure': features.get('surface_pressure'),
                'wind_speed': features.get('wind_speed'),
                'cloud_cover': features.get('cloud_cover')
            },
            'solunar': {
                'is_major_time': features.get('is_major_time', False),
                'is_minor_time': features.get('is_minor_time', False),
                'moon_phase': features.get('moon_phase')
            }
        }
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error in prediction: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/weather', methods=['GET'])
def get_weather():
    """Get current weather for a location"""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        
        # Get weather data
        weather_data = weather_collector.get_weather_data(lat, lon, datetime.now())
        
        if not weather_data:
            return jsonify({'error': 'Unable to fetch weather data'}), 500
        
        # Process weather features
        weather_features = weather_collector.process_weather_features(weather_data, datetime.now())
        
        return jsonify({
            'location': {'latitude': lat, 'longitude': lon},
            'weather': weather_features,
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error fetching weather: {e}")
        return jsonify({'error': 'Unable to fetch weather data'}), 500

@app.route('/api/forecast', methods=['GET'])
def get_forecast():
    """Get fishing forecast for next 24 hours"""
    try:
        lat = float(request.args.get('lat'))
        lon = float(request.args.get('lon'))
        fish_species = request.args.get('species', 'largemouth_bass')
        
        if predictor is None or predictor.model is None:
            return jsonify({'error': 'Prediction model not available'}), 503
        
        # Generate predictions for next 24 hours (every 3 hours)
        forecast = []
        current_time = datetime.now()
        
        for i in range(8):  # 8 predictions over 24 hours
            forecast_time = current_time + timedelta(hours=i * 3)
            
            # Generate features
            features = feature_engineer.create_features_for_location(
                lat, lon, forecast_time, fish_species
            )
            
            if features:
                # Make prediction
                prediction_result = predictor.predict_fishing_success(features)
                recommendations = predictor.get_recommendations(features, prediction_result)
                
                forecast.append({
                    'datetime': forecast_time.isoformat(),
                    'hour': forecast_time.hour,
                    'fishing_score': float(prediction_result['fishing_success_score']),
                    'rating': recommendations['overall_rating'],
                    'is_solunar_time': features.get('is_solunar_time', False),
                    'temperature': features.get('temperature'),
                    'weather_conditions': {
                        'cloud_cover': features.get('cloud_cover'),
                        'wind_speed': features.get('wind_speed'),
                        'pressure': features.get('surface_pressure')
                    }
                })
        
        return jsonify({
            'location': {'latitude': lat, 'longitude': lon},
            'fish_species': fish_species,
            'forecast': forecast,
            'generated_at': current_time.isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating forecast: {e}")
        return jsonify({'error': 'Unable to generate forecast'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize services
    initialize_services()
    
    # Run the Flask app
    app.run(host='0.0.0.0', port=5000, debug=True)
