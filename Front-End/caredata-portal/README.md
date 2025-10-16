🏥 CareData Portal

Smart Health Quality Indicator & Reporting Platform
(Aligned with Australian Government Health API Standards)

Developed by Team W08 – University of Wollongong

📘 Overview

CareData Portal is a modern web-based system that simplifies the collection, management, and reporting of Quality Indicator (QI) data for aged-care and healthcare facilities.
It helps organizations monitor performance, visualize insights, and generate AI-based recommendations that align with Australian Government Health API standards.

The project supports data exchange principles inspired by the Australian Government Health Developer Portal
, promoting secure interoperability and FHIR-compliant data practices.

🧱 Project Structure

CareData-Portal/
├── Back-End/ # REST API and analytics services
│ ├── src/
│ ├── routes/
│ └── package.json
│
├── Front-End/ # React + Tailwind UI for questionnaire & analytics
│ ├── src/
│ │ ├── components/
│ │ ├── pages/
│ │ └── App.js
│ └── package.json
│
└── Demo-Source-Code/ # Lightweight examples for front/back-end integration

⚙️ Tech Stack
Layer	Technologies
Front-End	React + Vite + Tailwind CSS + Recharts
Back-End	Node.js (Express) or Python (FastAPI / Django)
Database	PostgreSQL / Supabase
Deployment	AWS S3 + CloudFront (Frontend), Render / Railway (Backend)
Interoperability	FHIR / Australian Government Health API

🚀 Getting Started
1️⃣ Clone the Repository
git clone https://github.com/duongnguyen233/CareData-Portal.git
cd CareData-Portal

2️⃣ Back-End Setup
cd Back-End
npm install
npm run dev


Runs on http://localhost:5000

3️⃣ Front-End Setup
cd ../Front-End
npm install
npm run dev


Runs on http://localhost:3000

🧠 Key Features
🩺 Health Data Management

Collects and stores data across 14 Quality Indicator domains

Each domain includes structured fields and validation

📊 Analytics Dashboard

Radar, Bar, and Line charts to visualize performance

Auto-generated reports based on real-time data

🤖 AI-Assisted Insights

Predictive analytics for early issue detection

Provides improvement recommendations for each domain

🔒 Compliance & Integration

Built with FHIR-aligned data structures

Compatible with Australian Government Health API system

Follows privacy and security best practices

🏛️ Compliance & Standards

The CareData Portal is developed under principles aligned with:

Australian Digital Health Agency (ADHA) interoperability framework

Health Interoperability Framework (HIF)

Privacy Act 1988 (Cth) (handling of sensitive health data)

FHIR (Fast Healthcare Interoperability Resources) standards

Built to align with the Australian Government Health Developer Portal
 guidelines.

👥 Team W08 – University of Wollongong

Tuan Duong Nguyen (Dylan)

Ngoc Nhi Nguyen (Nelly)

Hazza Mohamed Omar Mohamed Alhashmi

Dang Bao Nguyen (Wayne)

Binh Minh Dau

📜 License

This project was developed as part of CSIT321 – Health Trends Analytics,
University of Wollongong (UOW).

© 2025 Team W08 — All rights reserved.
For educational and research use only.

🧩 Future Enhancements

Integration with My Health Record API

Real-time synchronization using FHIR endpoints

Enhanced role-based access control

Custom analytics dashboard for healthcare organizations

Cloud-deployed reporting API for large-scale data analytics

🩵 Government-Grade Reliability

CareData Portal is designed with a focus on:

Data transparency

Health interoperability compliance

Standardized government integration APIs

Our mission is to bridge healthcare data collection and national interoperability through modern technology — empowering aged-care and healthcare providers to improve quality, safety, and patient outcomes.