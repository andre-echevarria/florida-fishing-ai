import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Fish, MapPin, Clock, Thermometer, Wind, Cloud, Gauge, Star, Target, Lightbulb } from 'lucide-react'
import './App.css'

const API_BASE_URL = 'http://localhost:5001/api'

function App() {
  const [locations, setLocations] = useState([])
  const [fishSpecies, setFishSpecies] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [prediction, setPrediction] = useState(null)
  const [forecast, setForecast] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load initial data
  useEffect(() => {
    loadLocations()
    loadFishSpecies()
  }, [])

  const loadLocations = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/locations`)
      const data = await response.json()
      setLocations(data)
    } catch (err) {
      console.error('Error loading locations:', err)
    }
  }

  const loadFishSpecies = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/fish-species`)
      const data = await response.json()
      setFishSpecies(data)
    } catch (err) {
      console.error('Error loading fish species:', err)
    }
  }

  const makePrediction = async () => {
    if (!selectedLocation || !selectedSpecies) {
      setError('Please select both location and fish species')
      return
    }

    setLoading(true)
    setError('')

    try {
      const location = locations.find(l => l.id.toString() === selectedLocation)
      
      const response = await fetch(`${API_BASE_URL}/predict`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          fish_species: selectedSpecies,
          datetime: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get prediction')
      }

      const data = await response.json()
      setPrediction(data)

      // Also get forecast
      const forecastResponse = await fetch(
        `${API_BASE_URL}/forecast?lat=${location.latitude}&lon=${location.longitude}&species=${selectedSpecies}`
      )
      
      if (forecastResponse.ok) {
        const forecastData = await forecastResponse.json()
        setForecast(forecastData)
      }

    } catch (err) {
      setError('Failed to get prediction. Please try again.')
      console.error('Prediction error:', err)
    } finally {
      setLoading(false)
    }
  }

  const getRatingColor = (rating) => {
    switch (rating?.toLowerCase()) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-blue-500'
      case 'fair': return 'bg-yellow-500'
      case 'poor': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600'
    if (score >= 0.6) return 'text-blue-600'
    if (score >= 0.4) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Fish className="h-10 w-10 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">Florida Fishing AI</h1>
          </div>
          <p className="text-lg text-gray-600">
            Smart fishing predictions powered by AI, weather data, and local knowledge
          </p>
        </div>

        {/* Input Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Make a Prediction
            </CardTitle>
            <CardDescription>
              Select your target location and fish species to get AI-powered fishing recommendations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Fishing Location</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id.toString()}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {location.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Target Fish Species</label>
                <Select value={selectedSpecies} onValueChange={setSelectedSpecies}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select fish species" />
                  </SelectTrigger>
                  <SelectContent>
                    {fishSpecies.map((species) => (
                      <SelectItem key={species.id} value={species.id}>
                        <div className="flex items-center gap-2">
                          <Fish className="h-4 w-4" />
                          {species.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}

            <Button 
              onClick={makePrediction} 
              disabled={loading || !selectedLocation || !selectedSpecies}
              className="w-full"
            >
              {loading ? 'Analyzing...' : 'Get Fishing Prediction'}
            </Button>
          </CardContent>
        </Card>

        {/* Prediction Results */}
        {prediction && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Main Prediction */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Fishing Prediction
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className={`text-6xl font-bold ${getScoreColor(prediction.prediction.fishing_success_score)}`}>
                    {(prediction.prediction.fishing_success_score * 100).toFixed(0)}%
                  </div>
                  <div className="text-lg text-gray-600 mt-2">Success Probability</div>
                  <Badge className={`mt-2 ${getRatingColor(prediction.recommendations.overall_rating)}`}>
                    {prediction.recommendations.overall_rating}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-600" />
                    <span className="font-medium">Best Time:</span>
                    <span>{prediction.recommendations.best_time}</span>
                  </div>

                  {prediction.solunar.is_major_time && (
                    <Badge variant="outline" className="bg-green-50 text-green-700">
                      Major Solunar Time
                    </Badge>
                  )}

                  {prediction.solunar.is_minor_time && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                      Minor Solunar Time
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Weather Conditions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  Current Conditions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-red-500" />
                    <span className="text-sm">Temperature</span>
                    <span className="font-medium">{prediction.weather.temperature?.toFixed(1)}°F</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Wind className="h-4 w-4 text-blue-500" />
                    <span className="text-sm">Wind</span>
                    <span className="font-medium">{prediction.weather.wind_speed?.toFixed(1)} mph</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-purple-500" />
                    <span className="text-sm">Pressure</span>
                    <span className="font-medium">{prediction.weather.pressure?.toFixed(1)} hPa</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Cloud className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">Cloud Cover</span>
                    <span className="font-medium">{prediction.weather.cloud_cover}%</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Moon Phase</h4>
                  <Badge variant="outline">{prediction.solunar.moon_phase?.replace('_', ' ')}</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Recommendations */}
        {prediction && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Bait Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Fish className="h-5 w-5" />
                  Recommended Baits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {prediction.recommendations.recommended_baits?.map((bait, index) => (
                    <Badge key={index} variant="secondary">
                      {bait}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tips */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Fishing Tips
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {prediction.recommendations.tips?.map((tip, index) => (
                    <div key={index} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                  {(!prediction.recommendations.tips || prediction.recommendations.tips.length === 0) && (
                    <p className="text-gray-500 text-sm">No specific tips for current conditions</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 24-Hour Forecast */}
        {forecast && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                24-Hour Fishing Forecast
              </CardTitle>
              <CardDescription>
                Hourly predictions for the next 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {forecast.forecast?.map((item, index) => (
                  <div key={index} className="text-center p-3 border rounded-lg">
                    <div className="text-sm font-medium">
                      {new Date(item.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className={`text-2xl font-bold ${getScoreColor(item.fishing_score)}`}>
                      {(item.fishing_score * 100).toFixed(0)}%
                    </div>
                    <Badge 
                      size="sm" 
                      className={`mt-1 ${getRatingColor(item.rating)}`}
                    >
                      {item.rating}
                    </Badge>
                    {item.is_solunar_time && (
                      <div className="text-xs text-blue-600 mt-1">Solunar</div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>Powered by AI, weather data, and Florida fishing expertise</p>
        </div>
      </div>
    </div>
  )
}

export default App
