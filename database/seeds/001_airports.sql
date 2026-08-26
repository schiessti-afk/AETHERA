INSERT INTO airports (icao, iata, name, city, country, latitude, longitude, elevation_m)
VALUES
  ('KJFK', 'JFK', 'John F. Kennedy International Airport', 'New York', 'United States', 40.6413, -73.7781, 4),
  ('KLAX', 'LAX', 'Los Angeles International Airport', 'Los Angeles', 'United States', 33.9416, -118.4085, 38),
  ('EGLL', 'LHR', 'London Heathrow Airport', 'London', 'United Kingdom', 51.4700, -0.4543, 25),
  ('LFPG', 'CDG', 'Paris Charles de Gaulle Airport', 'Paris', 'France', 49.0097, 2.5479, 119),
  ('EDDF', 'FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany', 50.0379, 8.5622, 111),
  ('EHAM', 'AMS', 'Amsterdam Airport Schiphol', 'Amsterdam', 'Netherlands', 52.3105, 4.7683, -3),
  ('RJTT', 'HND', 'Tokyo Haneda Airport', 'Tokyo', 'Japan', 35.5494, 139.7798, 6),
  ('OMDB', 'DXB', 'Dubai International Airport', 'Dubai', 'United Arab Emirates', 25.2532, 55.3657, 19),
  ('YSSY', 'SYD', 'Sydney Kingsford Smith Airport', 'Sydney', 'Australia', -33.9399, 151.1753, 6),
  ('SBGR', 'GRU', 'São Paulo/Guarulhos International Airport', 'São Paulo', 'Brazil', -23.4356, -46.4731, 750)
ON CONFLICT (icao) DO NOTHING;
