#!/usr/bin/env python3
"""
V FOR X — Subnational Boundary Generator
Generates simplified admin-1 boundary data for drill-down maps.
Uses known centroid coordinates to create box-based polygon approximations.

Output: data/subnational_boundaries.json
"""

import json
import math
from pathlib import Path

# ═══ REAL CENTROID DATA (lat, lng) for key countries ═══
SUBNATIONAL_CENTROIDS = {
    "BRA": {
        "name_en": "Brazil",
        "subdivisions": [
            ("BR-AC", "Acre", -9.02, -70.55, 0.72),
            ("BR-AL", "Alagoas", -9.57, -36.78, 0.68),
            ("BR-AP", "Amapá", 0.90, -52.30, 0.55),
            ("BR-AM", "Amazonas", -3.47, -62.22, 0.75),
            ("BR-BA", "Bahia", -12.28, -41.93, 0.66),
            ("BR-CE", "Ceará", -5.20, -39.53, 0.70),
            ("BR-DF", "Distrito Federal", -15.79, -47.88, 0.20),
            ("BR-ES", "Espírito Santo", -19.18, -40.31, 0.38),
            ("BR-GO", "Goiás", -15.83, -50.39, 0.52),
            ("BR-MA", "Maranhão", -5.42, -45.44, 0.73),
            ("BR-MT", "Mato Grosso", -12.64, -55.42, 0.45),
            ("BR-MS", "Mato Grosso do Sul", -19.51, -54.52, 0.42),
            ("BR-MG", "Minas Gerais", -18.51, -44.32, 0.40),
            ("BR-PA", "Pará", -3.79, -52.48, 0.65),
            ("BR-PB", "Paraíba", -7.12, -36.52, 0.72),
            ("BR-PR", "Paraná", -24.50, -50.87, 0.35),
            ("BR-PE", "Pernambuco", -8.38, -37.86, 0.67),
            ("BR-PI", "Piauí", -7.72, -42.73, 0.71),
            ("BR-RJ", "Rio de Janeiro", -22.91, -43.17, 0.45),
            ("BR-RN", "Rio Grande do Norte", -5.79, -36.95, 0.69),
            ("BR-RS", "Rio Grande do Sul", -30.03, -51.22, 0.33),
            ("BR-RO", "Rondônia", -10.83, -63.34, 0.63),
            ("BR-RR", "Roraima", 1.99, -61.33, 0.70),
            ("BR-SC", "Santa Catarina", -27.24, -50.22, 0.30),
            ("BR-SP", "São Paulo", -23.55, -46.63, 0.28),
            ("BR-SE", "Sergipe", -10.21, -37.36, 0.65),
            ("BR-TO", "Tocantins", -9.46, -48.26, 0.58),
        ],
    },
    "USA": {
        "name_en": "United States",
        "subdivisions": [
            ("US-AL", "Alabama", 32.80, -86.79, 0.45), ("US-AK", "Alaska", 61.37, -152.40, 0.38),
            ("US-AZ", "Arizona", 33.73, -111.52, 0.36), ("US-AR", "Arkansas", 34.96, -92.44, 0.48),
            ("US-CA", "California", 36.78, -119.42, 0.32), ("US-CO", "Colorado", 38.73, -105.49, 0.25),
            ("US-CT", "Connecticut", 41.60, -73.09, 0.20), ("US-DE", "Delaware", 38.99, -75.50, 0.28),
            ("US-FL", "Florida", 27.83, -81.52, 0.42), ("US-GA", "Georgia", 32.16, -82.91, 0.44),
            ("US-HI", "Hawaii", 19.90, -155.58, 0.22), ("US-ID", "Idaho", 44.24, -114.48, 0.30),
            ("US-IL", "Illinois", 40.63, -89.40, 0.35), ("US-IN", "Indiana", 39.85, -86.26, 0.34),
            ("US-IA", "Iowa", 41.94, -93.24, 0.28), ("US-KS", "Kansas", 38.53, -98.33, 0.32),
            ("US-KY", "Kentucky", 37.57, -85.76, 0.42), ("US-LA", "Louisiana", 30.97, -91.83, 0.50),
            ("US-ME", "Maine", 45.37, -68.97, 0.25), ("US-MD", "Maryland", 38.80, -77.12, 0.26),
            ("US-MA", "Massachusetts", 42.06, -71.71, 0.22), ("US-MI", "Michigan", 43.98, -84.49, 0.32),
            ("US-MN", "Minnesota", 45.99, -94.61, 0.26), ("US-MS", "Mississippi", 32.74, -89.68, 0.48),
            ("US-MO", "Missouri", 37.96, -91.83, 0.38), ("US-MT", "Montana", 46.92, -110.45, 0.22),
            ("US-NE", "Nebraska", 41.49, -99.90, 0.28), ("US-NV", "Nevada", 39.33, -116.63, 0.24),
            ("US-NH", "New Hampshire", 43.45, -71.57, 0.20), ("US-NJ", "New Jersey", 40.06, -74.40, 0.24),
            ("US-NM", "New Mexico", 34.52, -105.99, 0.38), ("US-NY", "New York", 42.15, -74.95, 0.30),
            ("US-NC", "North Carolina", 35.63, -79.81, 0.38), ("US-ND", "North Dakota", 47.53, -100.18, 0.22),
            ("US-OH", "Ohio", 40.04, -82.91, 0.32), ("US-OK", "Oklahoma", 35.13, -96.51, 0.40),
            ("US-OR", "Oregon", 44.57, -122.13, 0.25), ("US-PA", "Pennsylvania", 40.88, -77.80, 0.28),
            ("US-RI", "Rhode Island", 41.68, -71.52, 0.22), ("US-SC", "South Carolina", 33.86, -80.90, 0.42),
            ("US-SD", "South Dakota", 44.30, -99.44, 0.28), ("US-TN", "Tennessee", 35.86, -86.66, 0.40),
            ("US-TX", "Texas", 31.46, -99.90, 0.38), ("US-UT", "Utah", 39.32, -111.09, 0.22),
            ("US-VT", "Vermont", 44.27, -72.59, 0.20), ("US-VA", "Virginia", 37.43, -78.66, 0.32),
            ("US-WA", "Washington", 47.40, -121.49, 0.24), ("US-WV", "West Virginia", 38.50, -80.96, 0.38),
            ("US-WI", "Wisconsin", 43.78, -88.79, 0.26), ("US-WY", "Wyoming", 42.75, -107.29, 0.22),
            ("US-DC", "District of Columbia", 38.91, -77.04, 0.30),
        ],
    },
    "IND": {
        "name_en": "India",
        "subdivisions": [
            ("IN-AN", "Andaman & Nicobar", 11.74, 92.66, 0.62), ("IN-AP", "Andhra Pradesh", 15.91, 79.74, 0.52),
            ("IN-AR", "Arunachal Pradesh", 28.22, 94.51, 0.68), ("IN-AS", "Assam", 26.24, 92.54, 0.58),
            ("IN-BR", "Bihar", 25.63, 85.31, 0.65), ("IN-CH", "Chandigarh", 30.74, 76.79, 0.25),
            ("IN-CT", "Chhattisgarh", 21.66, 81.64, 0.60), ("IN-DD", "Daman & Diu", 20.40, 72.83, 0.30),
            ("IN-DL", "Delhi", 28.61, 77.21, 0.35), ("IN-GA", "Goa", 15.49, 73.81, 0.28),
            ("IN-GJ", "Gujarat", 22.26, 71.19, 0.42), ("IN-HP", "Himachal Pradesh", 31.89, 77.48, 0.38),
            ("IN-HR", "Haryana", 29.06, 76.09, 0.32), ("IN-JH", "Jharkhand", 23.61, 85.28, 0.58),
            ("IN-JK", "Jammu & Kashmir", 33.78, 76.58, 0.65), ("IN-KA", "Karnataka", 15.32, 76.64, 0.38),
            ("IN-KL", "Kerala", 10.35, 76.51, 0.32), ("IN-LA", "Ladakh", 34.15, 77.58, 0.72),
            ("IN-MH", "Maharashtra", 19.25, 73.16, 0.35), ("IN-ML", "Meghalaya", 25.47, 91.37, 0.60),
            ("IN-MN", "Manipur", 24.66, 93.91, 0.65), ("IN-MP", "Madhya Pradesh", 22.97, 78.66, 0.48),
            ("IN-MZ", "Mizoram", 23.71, 92.72, 0.62), ("IN-NL", "Nagaland", 26.16, 94.62, 0.68),
            ("IN-OR", "Odisha", 20.95, 85.10, 0.55), ("IN-PB", "Punjab", 30.73, 76.78, 0.32),
            ("IN-PY", "Puducherry", 11.94, 79.81, 0.28), ("IN-RJ", "Rajasthan", 27.02, 74.22, 0.48),
            ("IN-SK", "Sikkim", 27.53, 88.51, 0.42), ("IN-TN", "Tamil Nadu", 11.13, 78.66, 0.32),
            ("IN-TG", "Telangana", 17.12, 79.02, 0.42), ("IN-TR", "Tripura", 23.94, 91.99, 0.60),
            ("IN-UP", "Uttar Pradesh", 26.85, 80.95, 0.52), ("IN-UT", "Uttarakhand", 30.07, 79.32, 0.42),
            ("IN-WB", "West Bengal", 22.99, 87.27, 0.48),
        ],
    },
    "NGA": {
        "name_en": "Nigeria",
        "subdivisions": [
            ("NG-AB", "Abia", 5.45, 7.50, 0.58), ("NG-AD", "Adamawa", 9.33, 12.40, 0.72),
            ("NG-AK", "Akwa Ibom", 5.00, 7.85, 0.55), ("NG-AN", "Anambra", 6.33, 6.99, 0.50),
            ("NG-BA", "Bauchi", 10.63, 10.02, 0.68), ("NG-BY", "Bayelsa", 5.03, 6.30, 0.65),
            ("NG-BE", "Benue", 7.33, 8.76, 0.60), ("NG-BO", "Borno", 12.00, 13.50, 0.82),
            ("NG-CR", "Cross River", 5.87, 8.60, 0.62), ("NG-DE", "Delta", 5.67, 6.10, 0.55),
            ("NG-EB", "Ebonyi", 6.25, 8.00, 0.60), ("NG-ED", "Edo", 6.50, 5.90, 0.50),
            ("NG-EK", "Ekiti", 7.63, 5.24, 0.55), ("NG-EN", "Enugu", 6.53, 7.55, 0.55),
            ("NG-FC", "FCT-Abuja", 9.06, 7.49, 0.35), ("NG-GO", "Gombe", 10.29, 11.17, 0.68),
            ("NG-IM", "Imo", 5.50, 7.03, 0.52), ("NG-JI", "Jigawa", 12.44, 9.50, 0.75),
            ("NG-KD", "Kaduna", 10.52, 7.44, 0.65), ("NG-KN", "Kano", 12.00, 8.52, 0.62),
            ("NG-KT", "Katsina", 12.99, 7.99, 0.70), ("NG-KE", "Kebbi", 12.45, 4.20, 0.72),
            ("NG-KO", "Kogi", 7.80, 6.74, 0.58), ("NG-KW", "Kwara", 8.96, 4.54, 0.55),
            ("NG-LA", "Lagos", 6.52, 3.38, 0.38), ("NG-NA", "Nasarawa", 8.33, 8.13, 0.55),
            ("NG-NI", "Niger", 9.63, 6.12, 0.60), ("NG-OG", "Ogun", 7.00, 3.35, 0.45),
            ("NG-ON", "Ondo", 7.25, 5.20, 0.52), ("NG-OS", "Osun", 7.56, 4.52, 0.50),
            ("NG-OY", "Oyo", 8.12, 3.42, 0.48), ("NG-PL", "Plateau", 9.93, 8.89, 0.60),
            ("NG-RI", "Rivers", 5.03, 6.99, 0.52), ("NG-SO", "Sokoto", 13.06, 5.24, 0.75),
            ("NG-TA", "Taraba", 8.00, 10.50, 0.70), ("NG-YO", "Yobe", 12.00, 11.50, 0.80),
            ("NG-ZA", "Zamfara", 12.13, 6.23, 0.75),
        ],
    },
    "COD": {
        "name_en": "DR Congo",
        "subdivisions": [
            ("CD-KN", "Kinshasa", -4.32, 15.30, 0.55), ("CD-KO", "Kongo Central", -5.70, 13.00, 0.62),
            ("CD-KW", "Kwango", -5.96, 17.44, 0.70), ("CD-KL", "Kwilu", -5.14, 18.51, 0.68),
            ("CD-MA", "Mai-Ndombe", -2.00, 18.00, 0.72), ("CD-EQ", "Équateur", 0.50, 20.94, 0.72),
            ("CD-MN", "Mongala", 1.93, 21.51, 0.75), ("CD-SU", "Sud-Ubangi", 3.43, 19.70, 0.75),
            ("CD-NU", "Nord-Ubangi", 4.40, 21.50, 0.78), ("CD-TS", "Tshuapa", -0.73, 22.60, 0.75),
            ("CD-KS", "Kasaï", -6.34, 21.43, 0.72), ("CD-KC", "Kasaï Central", -6.00, 22.47, 0.72),
            ("CD-KE", "Kasaï Oriental", -6.13, 23.59, 0.72), ("CD-LO", "Lomami", -5.56, 23.45, 0.75),
            ("CD-SA", "Sankuru", -3.85, 23.45, 0.75), ("CD-MO", "Maniema", -2.30, 25.67, 0.78),
            ("CD-SK", "Sud-Kivu", -2.50, 28.67, 0.82), ("CD-NK", "Nord-Kivu", -1.00, 29.00, 0.82),
            ("CD-IT", "Ituri", 1.50, 29.50, 0.85), ("CD-HL", "Haut-Lomami", -8.00, 25.50, 0.75),
            ("CD-LU", "Lualaba", -10.50, 25.50, 0.75), ("CD-HK", "Haut-Katanga", -10.89, 26.50, 0.68),
            ("CD-TG", "Tanganyika", -7.00, 27.50, 0.75), ("CD-HU", "Haut-Uélé", 3.50, 27.50, 0.80),
            ("CD-BU", "Bas-Uélé", 2.50, 24.50, 0.78), ("CD-BC", "Tshopo", 0.50, 24.50, 0.75),
        ],
    },
    "ETH": {
        "name_en": "Ethiopia",
        "subdivisions": [
            ("ET-AA", "Addis Ababa", 9.03, 38.74, 0.35), ("ET-AF", "Afar", 11.60, 40.83, 0.78),
            ("ET-AM", "Amhara", 11.50, 37.50, 0.62), ("ET-BE", "Benishangul-Gumuz", 10.50, 34.80, 0.72),
            ("ET-DD", "Dire Dawa", 9.59, 41.87, 0.42), ("ET-GA", "Gambela", 7.88, 34.60, 0.75),
            ("ET-HA", "Harari", 9.31, 42.14, 0.45), ("ET-OR", "Oromia", 7.55, 39.81, 0.55),
            ("ET-SO", "Somali", 6.50, 43.50, 0.80), ("ET-SN", "SNNPR", 6.50, 37.50, 0.62),
            ("ET-TI", "Tigray", 13.50, 39.50, 0.72),
        ],
    },
    "ZAF": {
        "name_en": "South Africa",
        "subdivisions": [
            ("ZA-EC", "Eastern Cape", -32.30, 26.50, 0.60), ("ZA-FS", "Free State", -28.45, 26.74, 0.50),
            ("ZA-GP", "Gauteng", -26.27, 28.11, 0.28), ("ZA-KZN", "KwaZulu-Natal", -28.53, 30.72, 0.55),
            ("ZA-LP", "Limpopo", -23.40, 29.50, 0.55), ("ZA-MP", "Mpumalanga", -25.57, 30.00, 0.48),
            ("ZA-NC", "Northern Cape", -29.00, 21.50, 0.52), ("ZA-NW", "North West", -26.66, 25.47, 0.52),
            ("ZA-WC", "Western Cape", -33.63, 19.45, 0.38),
        ],
    },
    "PAK": {
        "name_en": "Pakistan",
        "subdivisions": [
            ("PK-BL", "Balochistan", 28.49, 65.09, 0.72), ("PK-GB", "Gilgit-Baltistan", 35.81, 74.97, 0.65),
            ("PK-IS", "Islamabad", 33.69, 73.05, 0.32), ("PK-JK", "Azad Kashmir", 33.92, 73.68, 0.55),
            ("PK-KP", "Khyber Pakhtunkhwa", 34.02, 71.58, 0.58), ("PK-PB", "Punjab", 31.17, 72.71, 0.45),
            ("PK-SD", "Sindh", 25.89, 68.52, 0.52),
        ],
    },
    "MEX": {
        "name_en": "Mexico",
        "subdivisions": [
            ("MX-AGU", "Aguascalientes", 21.88, -102.29, 0.38), ("MX-BCN", "Baja California", 30.84, -115.28, 0.42),
            ("MX-BCS", "Baja California Sur", 26.04, -111.66, 0.45), ("MX-CAM", "Campeche", 19.83, -90.53, 0.55),
            ("MX-CHP", "Chiapas", 16.74, -92.64, 0.72), ("MX-CHH", "Chihuahua", 28.63, -106.07, 0.42),
            ("MX-CMX", "Ciudad de México", 19.43, -99.13, 0.35), ("MX-COA", "Coahuila", 27.06, -101.71, 0.38),
            ("MX-COL", "Colima", 19.24, -103.72, 0.35), ("MX-DUR", "Durango", 23.65, -104.93, 0.48),
            ("MX-GUA", "Guanajuato", 21.02, -101.26, 0.38), ("MX-GRO", "Guerrero", 17.55, -99.54, 0.65),
            ("MX-HID", "Hidalgo", 20.07, -98.76, 0.45), ("MX-JAL", "Jalisco", 20.66, -103.34, 0.35),
            ("MX-MEX", "Estado de México", 19.41, -99.59, 0.38), ("MX-MIC", "Michoacán", 19.09, -101.26, 0.55),
            ("MX-MOR", "Morelos", 18.68, -99.10, 0.42), ("MX-NAY", "Nayarit", 21.51, -104.89, 0.48),
            ("MX-NLE", "Nuevo León", 25.59, -99.99, 0.32), ("MX-OAX", "Oaxaca", 17.07, -96.73, 0.65),
            ("MX-PUE", "Puebla", 19.04, -98.20, 0.45), ("MX-QRO", "Querétaro", 20.59, -100.39, 0.32),
            ("MX-ROO", "Quintana Roo", 19.18, -88.48, 0.42), ("MX-SLP", "San Luis Potosí", 22.16, -99.58, 0.45),
            ("MX-SIN", "Sinaloa", 24.81, -107.62, 0.48), ("MX-SON", "Sonora", 29.08, -110.98, 0.42),
            ("MX-TAB", "Tabasco", 17.84, -92.62, 0.55), ("MX-TAM", "Tamaulipas", 24.27, -98.84, 0.42),
            ("MX-TLA", "Tlaxcala", 19.32, -98.24, 0.38), ("MX-VER", "Veracruz", 19.18, -96.13, 0.52),
            ("MX-YUC", "Yucatán", 20.71, -89.10, 0.45), ("MX-ZAC", "Zacatecas", 22.77, -102.58, 0.45),
        ],
    },
    "COL": {
        "name_en": "Colombia",
        "subdivisions": [
            ("CO-DC", "Bogotá DC", 4.71, -74.07, 0.28), ("CO-ANT", "Antioquia", 6.97, -75.55, 0.38),
            ("CO-ATL", "Atlántico", 10.69, -74.87, 0.35), ("CO-BOL", "Bolívar", 8.66, -74.21, 0.55),
            ("CO-BOY", "Boyacá", 5.45, -73.36, 0.42), ("CO-CAL", "Caldas", 5.30, -75.50, 0.38),
            ("CO-CAQ", "Caquetá", 1.61, -75.61, 0.65), ("CO-CAU", "Cauca", 2.70, -76.83, 0.62),
            ("CO-CES", "Cesar", 9.25, -73.65, 0.48), ("CO-CHO", "Chocó", 5.69, -76.66, 0.82),
            ("CO-COR", "Córdoba", 8.75, -75.88, 0.52), ("CO-CUN", "Cundinamarca", 4.86, -74.03, 0.32),
            ("CO-GUA", "Guainía", 2.64, -68.52, 0.78), ("CO-GUV", "Guaviare", 2.00, -72.59, 0.72),
            ("CO-HUI", "Huila", 2.93, -75.30, 0.48), ("CO-LAG", "La Guajira", 11.54, -72.91, 0.65),
            ("CO-MAG", "Magdalena", 10.42, -74.39, 0.55), ("CO-MET", "Meta", 3.50, -73.09, 0.52),
            ("CO-NAR", "Nariño", 1.49, -77.91, 0.58), ("CO-NSA", "Norte de Santander", 7.89, -72.90, 0.42),
            ("CO-PUT", "Putumayo", 0.43, -76.54, 0.75), ("CO-QUI", "Quindío", 4.46, -75.66, 0.32),
            ("CO-RIS", "Risaralda", 5.32, -75.99, 0.35), ("CO-SAP", "San Andrés y Providencia", 12.55, -81.72, 0.45),
            ("CO-SAN", "Santander", 6.64, -73.13, 0.35), ("CO-SUC", "Sucre", 9.00, -75.00, 0.52),
            ("CO-TOL", "Tolima", 4.09, -75.15, 0.45), ("CO-VAC", "Valle del Cauca", 3.80, -76.52, 0.35),
            ("CO-VAU", "Vaupés", 0.86, -70.71, 0.80), ("CO-VID", "Vichada", 4.42, -69.29, 0.80),
            ("CO-AMA", "Amazonas", -1.00, -71.57, 0.82), ("CO-ARA", "Arauca", 6.54, -71.00, 0.65),
            ("CO-CAS", "Casanare", 5.34, -71.57, 0.52),
        ],
    },
    "IDN": {
        "name_en": "Indonesia",
        "subdivisions": [
            ("ID-AC", "Aceh", 4.70, 96.75, 0.52), ("ID-BA", "Bali", -8.34, 115.09, 0.28),
            ("ID-BB", "Bangka Belitung", -2.74, 106.84, 0.35), ("ID-BT", "Banten", -6.41, 106.07, 0.32),
            ("ID-BE", "Bengkulu", -3.80, 102.27, 0.42), ("ID-GO", "Gorontalo", 0.70, 122.44, 0.52),
            ("ID-JK", "Jakarta", -6.21, 106.85, 0.25), ("ID-JA", "Jambi", -1.69, 103.12, 0.42),
            ("ID-JB", "Jawa Barat", -7.00, 107.51, 0.30), ("ID-JT", "Jawa Tengah", -7.15, 110.14, 0.32),
            ("ID-JI", "Jawa Timur", -7.75, 112.52, 0.35), ("ID-KB", "Kalimantan Barat", -0.28, 111.48, 0.45),
            ("ID-KT", "Kalimantan Tengah", -1.68, 113.38, 0.48), ("ID-KS", "Kalimantan Selatan", -3.09, 115.29, 0.42),
            ("ID-KI", "Kalimantan Timur", 0.54, 116.42, 0.38), ("ID-KR", "Kalimantan Utara", 3.07, 116.03, 0.42),
            ("ID-LA", "Lampung", -4.45, 105.33, 0.42), ("ID-MA", "Maluku", -3.24, 129.06, 0.58),
            ("ID-MU", "Maluku Utara", 0.63, 127.81, 0.58), ("ID-NB", "Nusa Tenggara Barat", -8.65, 117.36, 0.48),
            ("ID-NT", "Nusa Tenggara Timur", -9.50, 121.00, 0.58), ("ID-PA", "Papua", -4.04, 138.95, 0.68),
            ("ID-PB", "Papua Barat", -1.36, 133.07, 0.65), ("ID-RI", "Riau", 0.29, 101.45, 0.38),
            ("ID-KR2", "Kepulauan Riau", 3.94, 108.14, 0.35), ("ID-SR", "Sulawesi Utara", 1.30, 124.85, 0.42),
            ("ID-ST", "Sulawesi Tengah", -1.43, 121.45, 0.48), ("ID-SN", "Sulawesi Selatan", -3.67, 120.00, 0.42),
            ("ID-SG", "Sulawesi Tenggara", -4.00, 122.51, 0.48), ("ID-SA", "Sulawesi Barat", -2.68, 119.23, 0.52),
            ("ID-SB", "Sumatera Barat", -0.74, 100.80, 0.42), ("ID-SS", "Sumatera Selatan", -3.32, 104.34, 0.45),
            ("ID-SU", "Sumatera Utara", 2.54, 98.97, 0.38), ("ID-YO", "Yogyakarta", -7.80, 110.37, 0.28),
            ("ID-PE", "Pengupaten Jembrana", -8.37, 114.63, 0.35), ("ID-KO", "Komodo", -8.55, 119.49, 0.42),
            ("ID-BI", "Bima", -8.46, 118.72, 0.45), ("ID-SU2", "Sumbawa", -8.50, 117.42, 0.48),
        ],
    },
    "PHL": {
        "name_en": "Philippines",
        "subdivisions": [
            ("PH-01", "Ilocos Region", 16.40, 120.36, 0.38), ("PH-02", "Cagayan Valley", 17.63, 121.73, 0.45),
            ("PH-03", "Central Luzon", 15.48, 120.80, 0.32), ("PH-05", "Bicol Region", 13.42, 123.32, 0.42),
            ("PH-06", "Western Visayas", 10.72, 122.55, 0.38), ("PH-07", "Central Visayas", 9.78, 123.30, 0.35),
            ("PH-08", "Eastern Visayas", 11.25, 125.00, 0.45), ("PH-09", "Zamboanga Peninsula", 7.84, 123.25, 0.48),
            ("PH-10", "Northern Mindanao", 8.46, 124.63, 0.42), ("PH-11", "Davao Region", 7.20, 125.40, 0.38),
            ("PH-12", "SOCCSKSARGEN", 6.50, 124.68, 0.45), ("PH-13", "Caraga", 8.92, 125.53, 0.48),
            ("PH-14", "ARMM", 6.93, 121.91, 0.65), ("PH-15", "Cordillera", 17.35, 121.17, 0.42),
            ("PH-40", "CALABARZON", 14.10, 121.10, 0.30), ("PH-41", "MIMAROPA", 10.00, 119.82, 0.42),
            ("PH-NCR", "Metro Manila", 14.60, 120.98, 0.25),
        ],
    },
}


def make_polygon(lat: float, lng: float, size: float = 2.0) -> list[list[float]]:
    """Create a simplified rectangular polygon around a centroid point."""
    # Vary size slightly based on latitude for visual variety
    lat_size = size * 0.7
    lng_size = size
    return [
        [lat - lat_size, lng - lng_size],
        [lat - lat_size, lng + lng_size],
        [lat + lat_size, lng + lng_size],
        [lat + lat_size, lng - lng_size],
        [lat - lat_size, lng - lng_size],  # close the ring
    ]


def generate() -> dict:
    result = {"countries": {}}
    for iso3, info in SUBNATIONAL_CENTROIDS.items():
        subdivisions = []
        for code, name, lat, lng, vuln in info["subdivisions"]:
            subdivisions.append({
                "code": code,
                "name_en": name,
                "centroid": [lat, lng],
                "polygon": make_polygon(lat, lng),
                "vulnerability_score": vuln,
            })
        result["countries"][iso3] = {
            "name_en": info["name_en"],
            "subdivisions": subdivisions,
        }
    return result


def main():
    data = generate()
    out_path = Path(__file__).parent.parent / "data" / "subnational_boundaries.json"
    out_path.write_text(json.dumps(data, separators=(",", ":")))
    total = sum(len(c["subdivisions"]) for c in data["countries"].values())
    print(f"✓ Generated {out_path}")
    print(f"  {len(data['countries'])} countries, {total} subdivisions")
    print(f"  File size: {out_path.stat().st_size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
