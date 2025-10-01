#!/usr/bin/env python3
"""
Machine Learning Model Implementation for Florida Fishing AI

This script implements the core machine learning model for predicting fishing success
and providing recommendations for optimal fishing spots, times, and baits.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import xgboost as xgb
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime, timedelta
import logging
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class FishingPredictor:
    """Main class for fishing prediction model"""
    
    def __init__(self):
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoders = {}
        self.feature_names = []
        self.target_column = 'fishing_success'
        
    def load_data(self, file_path: str) -> pd.DataFrame:
        """Load training data from CSV file"""
        try:
            df = pd.read_csv(file_path)
            logger.info(f"Loaded {len(df)} samples with {len(df.columns)} features")
            return df
        except Exception as e:
            logger.error(f"Error loading data: {e}")
            return pd.DataFrame()
    
    def preprocess_data(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Preprocess the data for training"""
        # Make a copy to avoid modifying original data
        data = df.copy()
        
        # Handle categorical variables
        categorical_columns = ['fish_species', 'season', 'moon_phase', 'recommended_bait', 'bait_category']
        
        for col in categorical_columns:
            if col in data.columns:
                if col not in self.label_encoders:
                    self.label_encoders[col] = LabelEncoder()
                    data[col] = self.label_encoders[col].fit_transform(data[col].astype(str))
                else:
                    data[col] = self.label_encoders[col].transform(data[col].astype(str))
        
        # Remove non-feature columns
        columns_to_remove = ['timestamp', 'catch_count']  # Keep fishing_success as target
        for col in columns_to_remove:
            if col in data.columns:
                data = data.drop(columns=[col])
        
        # Separate features and target
        if self.target_column in data.columns:
            X = data.drop(columns=[self.target_column])
            y = data[self.target_column]
        else:
            logger.error(f"Target column '{self.target_column}' not found in data")
            return pd.DataFrame(), pd.Series()
        
        # Store feature names
        self.feature_names = X.columns.tolist()
        
        # Handle missing values
        X = X.fillna(X.mean())
        
        return X, y
    
    def train_model(self, X: pd.DataFrame, y: pd.Series) -> Dict:
        """Train the fishing prediction model"""
        logger.info("Starting model training...")
        
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale the features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Try multiple models and select the best one
        models = {
            'RandomForest': RandomForestRegressor(n_estimators=100, random_state=42),
            'GradientBoosting': GradientBoostingRegressor(n_estimators=100, random_state=42),
            'XGBoost': xgb.XGBRegressor(n_estimators=100, random_state=42)
        }
        
        best_model = None
        best_score = -np.inf
        model_results = {}
        
        for name, model in models.items():
            logger.info(f"Training {name}...")
            
            # Train the model
            if name == 'XGBoost':
                model.fit(X_train_scaled, y_train)
            else:
                model.fit(X_train_scaled, y_train)
            
            # Make predictions
            y_pred = model.predict(X_test_scaled)
            
            # Calculate metrics
            mse = mean_squared_error(y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            model_results[name] = {
                'model': model,
                'mse': mse,
                'rmse': rmse,
                'mae': mae,
                'r2': r2,
                'predictions': y_pred
            }
            
            logger.info(f"{name} - RMSE: {rmse:.4f}, R²: {r2:.4f}")
            
            # Select best model based on R² score
            if r2 > best_score:
                best_score = r2
                best_model = model
        
        self.model = best_model
        logger.info(f"Best model selected with R² score: {best_score:.4f}")
        
        return model_results
    
    def predict_fishing_success(self, features: Dict) -> Dict:
        """Predict fishing success for given features"""
        if self.model is None:
            logger.error("Model not trained yet")
            return {}
        
        # Convert features to DataFrame
        feature_df = pd.DataFrame([features])
        
        # Preprocess features (encode categorical variables)
        for col, encoder in self.label_encoders.items():
            if col in feature_df.columns:
                try:
                    feature_df[col] = encoder.transform(feature_df[col].astype(str))
                except ValueError:
                    # Handle unseen categories
                    feature_df[col] = 0
        
        # Ensure all required features are present
        for feature in self.feature_names:
            if feature not in feature_df.columns:
                feature_df[feature] = 0
        
        # Reorder columns to match training data
        feature_df = feature_df[self.feature_names]
        
        # Fill missing values
        feature_df = feature_df.fillna(0)
        
        # Scale features
        features_scaled = self.scaler.transform(feature_df)
        
        # Make prediction
        prediction = self.model.predict(features_scaled)[0]
        
        # Get feature importance if available
        feature_importance = {}
        if hasattr(self.model, 'feature_importances_'):
            importance_scores = self.model.feature_importances_
            feature_importance = dict(zip(self.feature_names, importance_scores))
            # Sort by importance
            feature_importance = dict(sorted(feature_importance.items(), 
                                           key=lambda x: x[1], reverse=True))
        
        return {
            'fishing_success_score': prediction,
            'confidence': min(max(prediction, 0), 1),  # Clamp between 0 and 1
            'feature_importance': feature_importance
        }
    
    def get_recommendations(self, features: Dict, prediction_result: Dict) -> Dict:
        """Generate fishing recommendations based on prediction and features"""
        recommendations = {
            'overall_rating': 'Poor',
            'best_time': 'Current conditions',
            'recommended_baits': [],
            'tips': []
        }
        
        score = prediction_result.get('fishing_success_score', 0)
        
        # Overall rating based on prediction score
        if score >= 0.8:
            recommendations['overall_rating'] = 'Excellent'
        elif score >= 0.6:
            recommendations['overall_rating'] = 'Good'
        elif score >= 0.4:
            recommendations['overall_rating'] = 'Fair'
        else:
            recommendations['overall_rating'] = 'Poor'
        
        # Time recommendations based on Solunar data
        if features.get('is_major_time', False):
            recommendations['best_time'] = 'Major feeding time - Excellent!'
        elif features.get('is_minor_time', False):
            recommendations['best_time'] = 'Minor feeding time - Good'
        
        # Bait recommendations based on temperature and species
        temp = features.get('temperature', 70)
        species = features.get('fish_species', 'largemouth_bass')
        
        if species == 'largemouth_bass' or species == 0:  # 0 might be encoded value
            if temp < 50:
                recommendations['recommended_baits'] = ['Jig', 'Blade Bait', 'Suspending Jerkbait']
            elif temp < 65:
                recommendations['recommended_baits'] = ['Spinnerbait', 'Crankbait', 'Jig']
            elif temp < 80:
                recommendations['recommended_baits'] = ['Topwater', 'Plastic Worm', 'Crankbait']
            else:
                recommendations['recommended_baits'] = ['Deep Crankbait', 'Carolina Rig', 'Drop Shot']
        
        # Weather-based tips
        wind_speed = features.get('wind_speed', 0)
        cloud_cover = features.get('cloud_cover', 50)
        pressure = features.get('surface_pressure', 1013)
        
        if wind_speed > 15:
            recommendations['tips'].append('High winds - try sheltered areas')
        
        if cloud_cover > 80:
            recommendations['tips'].append('Overcast conditions - good for topwater')
        elif cloud_cover < 20:
            recommendations['tips'].append('Clear skies - fish deeper structures')
        
        if pressure < 1010:
            recommendations['tips'].append('Low pressure - fish may be less active')
        elif pressure > 1020:
            recommendations['tips'].append('High pressure - try deeper water')
        
        return recommendations
    
    def save_model(self, file_path: str):
        """Save the trained model and preprocessors"""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'label_encoders': self.label_encoders,
            'feature_names': self.feature_names
        }
        joblib.dump(model_data, file_path)
        logger.info(f"Model saved to {file_path}")
    
    def load_model(self, file_path: str):
        """Load a trained model and preprocessors"""
        try:
            model_data = joblib.load(file_path)
            self.model = model_data['model']
            self.scaler = model_data['scaler']
            self.label_encoders = model_data['label_encoders']
            self.feature_names = model_data['feature_names']
            logger.info(f"Model loaded from {file_path}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
    
    def plot_feature_importance(self, top_n: int = 15):
        """Plot feature importance"""
        if self.model is None or not hasattr(self.model, 'feature_importances_'):
            logger.warning("Model not available or doesn't support feature importance")
            return
        
        importance_scores = self.model.feature_importances_
        feature_importance = pd.DataFrame({
            'feature': self.feature_names,
            'importance': importance_scores
        }).sort_values('importance', ascending=False).head(top_n)
        
        plt.figure(figsize=(10, 8))
        sns.barplot(data=feature_importance, x='importance', y='feature')
        plt.title('Top Feature Importance for Fishing Success Prediction')
        plt.xlabel('Importance Score')
        plt.tight_layout()
        plt.savefig('feature_importance.png', dpi=300, bbox_inches='tight')
        plt.show()

def main():
    """Main function to train and evaluate the fishing prediction model"""
    
    # Initialize the predictor
    predictor = FishingPredictor()
    
    # Load training data
    df = predictor.load_data('data/training_data.csv')
    if df.empty:
        logger.error("No training data available")
        return
    
    # Preprocess data
    X, y = predictor.preprocess_data(df)
    if X.empty:
        logger.error("Data preprocessing failed")
        return
    
    # Train the model
    model_results = predictor.train_model(X, y)
    
    # Save the model
    predictor.save_model('models/fishing_predictor.joblib')
    
    # Plot feature importance
    predictor.plot_feature_importance()
    
    # Test prediction with sample data
    sample_features = {
        'latitude': 28.5383,
        'longitude': -81.3792,
        'fish_species': 'largemouth_bass',
        'temperature': 75.0,
        'relative_humidity': 65,
        'surface_pressure': 1013.2,
        'cloud_cover': 40,
        'wind_speed': 8.5,
        'hour': 7,
        'month': 9,
        'season': 'fall',
        'is_major_time': True,
        'moon_phase': 'first_quarter',
        'depth': 15.5
    }
    
    prediction = predictor.predict_fishing_success(sample_features)
    recommendations = predictor.get_recommendations(sample_features, prediction)
    
    print("\n" + "="*50)
    print("SAMPLE PREDICTION RESULTS")
    print("="*50)
    print(f"Fishing Success Score: {prediction['fishing_success_score']:.3f}")
    print(f"Confidence: {prediction['confidence']:.3f}")
    print(f"Overall Rating: {recommendations['overall_rating']}")
    print(f"Best Time: {recommendations['best_time']}")
    print(f"Recommended Baits: {', '.join(recommendations['recommended_baits'])}")
    if recommendations['tips']:
        print(f"Tips: {'; '.join(recommendations['tips'])}")
    
    print("\nTop 5 Most Important Features:")
    for i, (feature, importance) in enumerate(list(prediction['feature_importance'].items())[:5]):
        print(f"{i+1}. {feature}: {importance:.4f}")

if __name__ == "__main__":
    main()
