# Project Spark – Mobile Application

This repository contains the **companion mobile application** for **Project Spark**, providing configuration, monitoring, and OTA management for Project Spark devices.

The application enables:
- BLE communication with Project Spark hardware
- Device provisioning and configuration
- Application selection and OTA updates
- Sensor data visualization
- Device health and status monitoring

---

## Supported Platforms

- **Android**
- **iOS**

The application is designed using a **single shared codebase** to support both platforms.

---

## Repository Structure

```text
.
├── app/               # Application source code
├── components/        # Reusable UI components
├── services/          # BLE, OTA, and backend services
├── assets/            # Images and static assets
├── scripts/           # Build, flash, environment, and utility scripts
├── docs/              # UX flows and technical notes
├── .github/           # CI, CODEOWNERS, repo configuration
└── README.md
