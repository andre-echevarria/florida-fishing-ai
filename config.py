#!/usr/bin/env python3
"""
Configuration file for the Florida Fishing AI Model
"""

import os
from typing import List, Tuple

# API Configuration
# OPENWEATHER_API_KEY is no longer needed as Open-Meteo is used

# Florida Freshwater Locations (lat, lon, name)

FLORIDA_FISHING_LOCATIONS = [
    (28.5383, -81.3792, "Lake Tohopekaliga"),
    (27.8006, -81.3378, "Lake Kissimmee"),
    (28.0836, -82.7127, "Lake Tarpon"),
    (29.6516, -82.3248, "Orange Lake"),
    (26.7153, -80.9498, "Lake Okeechobee North"),
    (26.9342, -80.8756, "Lake Okeechobee Central"),
    (27.0339, -80.7731, "Lake Okeechobee East"),
    (28.7589, -81.2389, "Lake Apopka"),
    (28.6139, -81.5614, "Lake Harris"),
    (28.8606, -81.8728, "Lake Dora"),
    (29.1858, -81.6081, "Lake George"),
    (30.1218, -81.7679, "St. Johns River - Jacksonville"),
    (28.4158, -80.5492, "Indian River Lagoon"),
    (25.7617, -80.1918, "Everglades - Miami"),
    (26.1224, -81.7987, "Caloosahatchee River")
]

# Fish Species Configuration
FISH_SPECIES = {
    'largemouth_bass': {
        'name': 'Largemouth Bass',
        'optimal_temp_range': (60, 80),
        'preferred_structures': ['submerged_timber', 'vegetation_edges', 'drop_offs'],
        'seasonal_patterns': {
            'spring': 'shallow_spawning',
            'summer': 'deep_structure',
            'fall': 'feeding_aggressive',
            'winter': 'deep_slow'
        }
    },
    'crappie': {
        'name': 'Crappie',
        'optimal_temp_range': (55, 75),
        'preferred_structures': ['brush_piles', 'submerged_timber', 'bridge_pilings'],
        'seasonal_patterns': {
            'spring': 'shallow_spawning',
            'summer': 'suspended_deep',
            'fall': 'schooling_shallow',
            'winter': 'deep_structure'
        }
    },
    'bluegill': {
        'name': 'Bluegill',
        'optimal_temp_range': (65, 85),
        'preferred_structures': ['shallow_vegetation', 'spawning_beds', 'docks'],
        'seasonal_patterns': {
            'spring': 'spawning_beds',
            'summer': 'shallow_cover',
            'fall': 'vegetation_edges',
            'winter': 'deeper_water'
        }
    }
}

# Weather Feature Thresholds
WEATHER_THRESHOLDS = {
    'optimal_pressure_range': (29.8, 30.2),  # inches Hg
    'optimal_wind_speed': (0, 15),  # mph
    'optimal_cloud_cover': (20, 80),  # percentage
    'rain_impact_hours': 24,  # hours after rain to consider impact
}

# Solunar Configuration
SOLUNAR_CONFIG = {
    'major_time_duration': 2,  # hours
    'minor_time_duration': 1,  # hours
    'moon_phase_weights': {
        'new_moon': 0.8,
        'first_quarter': 1.0,
        'full_moon': 1.2,
        'last_quarter': 0.9
    }
}

# Bait Recommendations by Temperature (Fahrenheit)
BAIT_RECOMMENDATIONS = {
    'largemouth_bass': {
        (32, 45): ['jig', 'blade_bait', 'suspending_jerkbait'],
        (45, 55): ['spinnerbait', 'crankbait', 'jig'],
        (55, 65): ['spinnerbait', 'chatterbait', 'topwater'],
        (65, 75): ['topwater', 'plastic_worm', 'crankbait'],
        (75, 85): ['topwater', 'buzzbait', 'plastic_worm'],
        (85, 95): ['deep_crankbait', 'carolina_rig', 'drop_shot']
    },
    'crappie': {
        (32, 50): ['small_jig', 'minnow'],
        (50, 70): ['jig_and_minnow', 'small_spinnerbait'],
        (70, 85): ['small_crankbait', 'tube_jig'],
        (85, 95): ['deep_jig', 'live_minnow']
    }
}

# Data Collection Configuration
DATA_CONFIG = {
    'collection_interval_hours': 6,
    'max_api_calls_per_minute': 60,
    'data_retention_days': 365,
    'batch_size': 100
}

# File Paths
DATA_PATHS = {
    'bathymetry_data': 'data/fwc_bathymetry.csv',
    'training_data': 'data/training_data.csv',
    'model_output': 'models/',
    'logs': 'logs/',
    'cache': 'cache/'
}

# Model Configuration
MODEL_CONFIG = {
    'test_size': 0.2,
    'random_state': 42,
    'cv_folds': 5,
    'hyperparameter_tuning': True,
    'feature_importance_threshold': 0.01
}

# Ensure directories exist
import os
for path in DATA_PATHS.values():
    if '.' not in path:  # It's a directory
        os.makedirs(path, exist_ok=True)
