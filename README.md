# 🔐 KYC Risk Analyser

A KYC verification system that combines **instruction-based face verification** and **AI-powered anti-spoofing** to assess the authenticity of a verification attempt and generate an overall **KYC risk score**.

The project is built using **Next.js**, **FastAPI**, and **MiniFASNet**.

---

## 🚀 Overview

The goal of this project is to provide an additional security layer to the KYC verification process.

Instead of relying only on a selfie, the system:

* Gives instructions to the user.
* Captures the user's face through the camera.
* Verifies whether the required instructions are followed.
* Uses **MiniFASNet** for face anti-spoofing.
* Combines the verification results.
* Generates an overall **KYC risk score**.

The system can then classify the verification attempt into different risk levels such as:

**Low Risk → Medium Risk → High Risk**

---

## 🏗️ Architecture

```text
                         ┌───────────────┐
                         │     User      │
                         └───────┬───────┘
                                 │
                                 ▼
                     ┌─────────────────────┐
                     │      Next.js        │
                     │      Frontend       │
                     │                     │
                     │ • Camera Access     │
                     │ • Instructions      │
                     │ • Frame Capture     │
                     │ • Result Display    │
                     └──────────┬──────────┘
                                │
                           API Request
                                │
                                ▼
                     ┌─────────────────────┐
                     │      FastAPI        │
                     │      Backend        │
                     │                     │
                     │ • API Endpoints     │
                     │ • Verification      │
                     │ • Risk Calculation  │
                     └──────────┬──────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
          ┌──────────────────┐    ┌──────────────────┐
          │   Instruction    │    │    MiniFASNet    │
          │   Verification   │    │  Anti-Spoofing   │
          └────────┬─────────┘    └────────┬─────────┘
                   │                       │
                   └───────────┬───────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │    Risk Engine      │
                    │                     │
                    │  Final KYC Score    │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Verification Result │
                    │ Low / Medium / High │
                    └─────────────────────┘
```

---

## 🔄 Verification Flow

```text
User
  │
  ▼
Start KYC
  │
  ▼
Camera Access
  │
  ▼
Receive Instructions
  │
  ▼
Capture Face Frames
  │
  ▼
Send Data to FastAPI
  │
  ├───────────────┐
  ▼               ▼
Instruction     MiniFASNet
Verification    Anti-Spoofing
  │               │
  └───────┬───────┘
          ▼
    Risk Calculation
          │
          ▼
    Final KYC Score
          │
          ▼
   Risk Classification
```

---

## 🧠 Anti-Spoofing

The project uses **MiniFASNet** as the face anti-spoofing model.

The purpose of the model is to determine whether the captured face appears to be a genuine face or a potential presentation attack.

For example, the system should be able to identify suspicious inputs such as:

* 📷 Printed photographs
* 🎥 Replayed videos
* 🖥️ Digital face presentations
* Other presentation attacks

MiniFASNet provides an anti-spoofing prediction/confidence that is used as one of the signals in the overall risk analysis.

> **Note:** Anti-spoofing is treated as one component of the overall verification process rather than the sole basis for determining identity.

---

## 🎯 Instruction-Based Verification

The system provides instructions to the user during the KYC process.

The user needs to perform the required action while the camera captures the relevant frames.

The system evaluates whether the expected instruction was successfully completed.

This adds a dynamic verification layer instead of relying on a single static selfie.

---

## 📊 Risk Scoring

The final risk score is calculated by combining multiple verification signals.

Conceptually:

```text
                 Verification Signals
                         │
             ┌───────────┴───────────┐
             │                       │
             ▼                       ▼
    Instruction Result       Anti-Spoof Result
             │                       │
             └───────────┬───────────┘
                         ▼
                   Risk Engine
                         │
                         ▼
                  Final Risk Score
                         │
             ┌───────────┼───────────┐
             ▼           ▼           ▼
          Low Risk   Medium Risk   High Risk
```

A successful instruction verification combined with a genuine-face prediction results in a lower-risk assessment.

Failed instructions or indications of spoofing can increase the risk level.

---

# 🛠️ Tech Stack

## Frontend

* **Next.js**
* **React**
* **TypeScript**
* Browser Camera APIs
* REST API integration

## Backend

* **FastAPI**
* **Python**
* **Uvicorn**
* **OpenCV**
* Machine Learning inference

## AI

* **MiniFASNet**
* Face anti-spoofing
* Computer vision

---

# 🌿 Branch Structure

The project uses separate branches for the frontend and backend.

| Branch   | Component | Technology                    |
| -------- | --------- | ----------------------------- |
| `main`   | Backend   | FastAPI + Python + MiniFASNet |
| `master` | Frontend  | Next.js + React + TypeScript  |

### Backend — `main`

The `main` branch contains the backend implementation:

```text
main
│
├── FastAPI APIs
├── Face Processing
├── MiniFASNet
├── Anti-Spoofing
├── Instruction Verification
└── Risk Calculation
```

### Frontend — `master`

The `master` branch contains the frontend implementation:

```text
master
│
├── Next.js Application
├── KYC Interface
├── Camera Integration
├── User Instructions
├── API Integration
└── Result Display
```

---

# 📁 Project Structure

## Backend (`main`)

```text
backend/
│
├── app/
│   ├── api/
│   ├── models/
│   ├── services/
│   ├── utils/
│   └── main.py
│
├── models/
│   └── MiniFASNet/
│
├── requirements.txt
└── README.md
```

## Frontend (`master`)

```text
frontend/
│
├── app/
├── components/
├── public/
├── services/
├── package.json
├── tsconfig.json
└── README.md
```

> The exact directory structure may vary depending on the implementation.

---

# ⚙️ Backend Setup

Switch to the backend branch:

```bash
git checkout main
```

Clone the repository:

```bash
git clone <repository-url>
cd <repository-name>
```

Create a virtual environment:

```bash
python -m venv venv
```

### Windows

```bash
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start the FastAPI server:

```bash
uvicorn app.main:app --reload
```

The backend will run on:

```text
http://localhost:8000
```

FastAPI Swagger documentation:

```text
http://localhost:8000/docs
```

---

# 💻 Frontend Setup

Switch to the frontend branch:

```bash
git checkout master
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The frontend will run on:

```text
http://localhost:3000
```

---

# 🔗 API Communication

The frontend communicates with the FastAPI backend using REST APIs.

```text
Next.js Frontend
       │
       │ HTTP Request
       ▼
FastAPI Backend
       │
       ├── Validate Request
       ├── Process Face Data
       ├── Run MiniFASNet
       ├── Verify Instructions
       └── Calculate Risk
       │
       ▼
JSON Response
       │
       ▼
Next.js Frontend
       │
       ▼
Display KYC Result
```

Make sure the FastAPI backend is running before starting the KYC verification from the frontend.

---

# 🔒 Security

The project provides multiple security signals through:

* Face anti-spoofing
* Dynamic user instructions
* Server-side verification
* Risk scoring
* Separation of frontend and backend responsibilities

The risk score should be considered a **risk assessment signal** and not the sole basis for real-world identity verification.

---

# ✨ Key Features

* ✅ Camera-based KYC verification
* ✅ Instruction-based verification
* ✅ Face anti-spoofing
* ✅ MiniFASNet integration
* ✅ FastAPI backend
* ✅ Next.js frontend
* ✅ Automated risk scoring
* ✅ Risk classification
* ✅ REST API communication
* ✅ Real-time verification workflow

---

# 🔮 Future Improvements

Possible improvements include:

* 📄 Government ID document verification
* 🔍 OCR-based document extraction
* 👤 Face matching between ID and live user
* 🗄️ Verification history database
* 🔐 User authentication and authorization
* 📈 Advanced fraud-risk analysis
* 🐳 Docker deployment
* ☁️ Cloud deployment
* 📊 Admin dashboard
* 🔔 Suspicious verification alerts

---

# 👨‍💻 Project Summary

**KYC Risk Analyser** combines frontend camera interaction, backend API processing, instruction-based verification, and AI-powered anti-spoofing to generate a risk assessment for KYC verification attempts.

### Built With

**Next.js • FastAPI • Python • MiniFASNet • OpenCV**

---

## 📌 Branch Summary

```text
main   → Backend → FastAPI + MiniFASNet
master → Frontend → Next.js
```

**KYC Risk Analyser — Secure. Intelligent. Risk-Aware.**
