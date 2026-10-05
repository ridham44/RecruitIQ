// Demo data for the "Nfs" agency (ceo@nfs.com): 2 jobs each for its clients
// Ferrari and McLaren, linked to the client's department and Company HR, with
// 6 applicants per job (strong / medium / weak fits) and a real .docx CV each.
// Everything stays APPLIED so "Run AI Screening" can rank them live.
//
//   node scripts/seed-nfs.mjs          → create (re-running replaces the same data)
//
// Fake candidates use @nfsdemo.example addresses (no real inbox) and share
// the password below. No AI calls — deterministic, like prisma/seed.js.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { buildDocx, DOCX_MIME } from './lib/testDocx.mjs';

const prisma = new PrismaClient();
const AGENCY_EMAIL = 'ceo@nfs.com';
const DOMAIN = 'nfsdemo.example';
const PASSWORD = 'Demo@1234';
const DAY = 24 * 60 * 60 * 1000;

const JOBS = [
  {
    client: 'Ferrari',
    title: 'Full Stack Developer – Race Telemetry Platform',
    description: `Scuderia Ferrari is looking for a Full Stack Developer to build the web platform our race
engineers use to watch live car telemetry during sessions and analyse it afterwards.

Responsibilities:
- Build real-time dashboards in React + TypeScript that stream telemetry over WebSockets
- Design and maintain Node.js REST APIs backed by PostgreSQL
- Work with race engineers to turn analysis needs into product features
- Keep the platform fast and reliable on race weekends

Requirements:
- 3+ years building production web apps with React and Node.js
- Strong TypeScript, REST API design and PostgreSQL
- Comfortable owning features end to end

Nice to have:
- WebSockets / real-time data, Docker, AWS
- Grafana or other time-series visualisation
- Interest in motorsport`,
    minimumExperience: 3,
    maximumExperience: 7,
    requiredSkills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'REST API'],
    preferredSkills: ['WebSockets', 'Docker', 'AWS', 'Grafana'],
    educationRequirements: ['Computer Science', 'Information Technology', 'Computer Engineering'],
    location: 'Maranello, Italy',
    workMode: 'Hybrid',
    jobLevel: 'Senior',
    openings: 2,
    noticePeriod: '60 days',
    languagesRequired: ['English', 'Italian'],
    salaryRange: '€55k–75k',
    summary: 'Full stack React/Node.js developer for a real-time race telemetry platform.',
    candidates: [
      {
        fullName: 'Luca Bianchi', gender: 'MALE', location: 'Modena, Italy', headline: 'Senior Full Stack Engineer',
        years: 5.5, skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'WebSockets', 'Docker', 'AWS', 'Redis', 'REST API'],
        summary: 'Full stack engineer with 5.5 years building real-time web platforms in React, TypeScript and Node.js.',
        experience: [
          { company: 'Dallara Digital', role: 'Senior Full Stack Engineer', from: 2022, to: null, bullets: ['Built a live sensor dashboard in React + TypeScript streaming 2,000 data points/sec over WebSockets', 'Designed Node.js REST APIs on PostgreSQL with partitioned time-series tables', 'Moved deployment to Docker on AWS ECS, cutting release time from hours to minutes'] },
          { company: 'Teknos Srl', role: 'Full Stack Developer', from: 2019, to: 2022, bullets: ['Built React admin portals and Express APIs for logistics clients', 'Introduced TypeScript across the codebase'] },
        ],
        education: [{ degree: 'M.Sc', fieldOfStudy: 'Computer Engineering', institution: 'Politecnico di Milano', startYear: 2017, endYear: 2019, grade: '108/110' }],
        projects: ['Open-source lap-time visualiser (React, D3, WebSockets)'],
        certifications: ['AWS Certified Developer – Associate'],
      },
      {
        fullName: 'Aarav Shah', gender: 'MALE', location: 'Pune, India', headline: 'Full Stack Developer (MERN + TypeScript)',
        years: 4, skills: ['React', 'Node.js', 'TypeScript', 'MongoDB', 'PostgreSQL', 'Express', 'Docker', 'REST API'],
        summary: 'Full stack developer with 4 years on React and Node.js products, recently moved from MongoDB to PostgreSQL.',
        experience: [
          { company: 'Zentrix Labs', role: 'Full Stack Developer', from: 2021, to: null, bullets: ['Built a fleet-tracking dashboard in React + TypeScript with live map updates', 'Migrated core services from MongoDB to PostgreSQL', 'Containerised services with Docker'] },
        ],
        education: [{ degree: 'B.E.', fieldOfStudy: 'Computer Engineering', institution: 'Savitribai Phule Pune University', startYear: 2016, endYear: 2020, grade: '8.4 CGPA' }],
        projects: ['Expense-sharing app (React, Node.js, PostgreSQL)'],
        certifications: [],
      },
      {
        fullName: 'Sofia Romano', gender: 'FEMALE', location: 'Bologna, Italy', headline: 'Frontend Developer (React + TypeScript)',
        years: 3, skills: ['React', 'TypeScript', 'Redux', 'HTML', 'CSS', 'Jest', 'Node.js'],
        summary: 'Frontend developer with 3 years of React and TypeScript; light Node.js experience.',
        experience: [
          { company: 'Unipol Tech', role: 'Frontend Developer', from: 2022, to: null, bullets: ['Built insurance quote flows in React + TypeScript + Redux', 'Raised unit test coverage to 70% with Jest'] },
          { company: 'Freelance', role: 'Web Developer', from: 2021, to: 2022, bullets: ['Small Express APIs for client websites'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Computer Science', institution: 'University of Bologna', startYear: 2018, endYear: 2021, grade: '102/110' }],
        projects: ['Weather dashboard (React, TypeScript, Chart.js)'],
        certifications: [],
      },
      {
        fullName: 'Neha Kulkarni', gender: 'FEMALE', location: 'Bengaluru, India', headline: 'Java Full Stack Developer',
        years: 6, skills: ['Java', 'Spring Boot', 'Angular', 'MySQL', 'REST API', 'Kafka', 'Docker'],
        summary: 'Java full stack developer with 6 years on Spring Boot and Angular enterprise applications.',
        experience: [
          { company: 'Infosys', role: 'Senior Software Engineer', from: 2019, to: null, bullets: ['Built Spring Boot microservices and Angular frontends for a banking client', 'Event pipelines with Kafka'] },
          { company: 'Mindtree', role: 'Software Engineer', from: 2018, to: 2019, bullets: ['Maintained Java web applications on MySQL'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Information Technology', institution: 'VIT Vellore', startYear: 2014, endYear: 2018, grade: '8.1 CGPA' }],
        projects: [],
        certifications: ['Oracle Certified Professional: Java SE 11'],
      },
      {
        fullName: 'Marco Conti', gender: 'MALE', location: 'Maranello, Italy', headline: 'Junior Web Developer',
        years: 1, skills: ['React', 'JavaScript', 'HTML', 'CSS', 'Node.js'],
        summary: 'Junior developer with 1 year of React; keen to grow into full stack work.',
        experience: [
          { company: 'WebItalia', role: 'Junior Web Developer', from: 2024, to: null, bullets: ['Built React components for e-commerce sites', 'Small fixes on an Express backend'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Computer Science', institution: 'University of Modena and Reggio Emilia', startYear: 2020, endYear: 2023, grade: '98/110' }],
        projects: ['Personal portfolio (React)'],
        certifications: [],
      },
      {
        fullName: 'Rohan Gupta', gender: 'MALE', location: 'Noida, India', headline: 'QA Automation Engineer',
        years: 2.5, skills: ['Selenium', 'Java', 'TestNG', 'Postman', 'SQL', 'Jenkins'],
        summary: 'QA automation engineer with 2.5 years writing Selenium and API test suites.',
        experience: [
          { company: 'HCL Technologies', role: 'QA Automation Engineer', from: 2022, to: null, bullets: ['Automated 400+ regression cases with Selenium + TestNG', 'API testing with Postman and SQL checks'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Electronics and Communication', institution: 'AKTU', startYear: 2018, endYear: 2022, grade: '7.2 CGPA' }],
        projects: [],
        certifications: ['ISTQB Foundation Level'],
      },
    ],
  },
  {
    client: 'Ferrari',
    title: 'Data Engineer – Performance Analytics',
    description: `Join Scuderia Ferrari's performance analytics team and build the data pipelines behind
car setup, tyre and strategy decisions.

Responsibilities:
- Build batch and streaming pipelines for car and simulator data
- Model data for analysts and race strategists
- Own data quality and pipeline reliability

Requirements:
- 2+ years as a data engineer
- Python, SQL, Apache Spark, Kafka
- Cloud data platforms (AWS preferred)

Nice to have:
- Airflow, dbt
- Time-series databases
- Experience with sensor or IoT data`,
    minimumExperience: 2,
    maximumExperience: 6,
    requiredSkills: ['Python', 'SQL', 'Apache Spark', 'Kafka', 'AWS'],
    preferredSkills: ['Airflow', 'dbt', 'Time-series databases'],
    educationRequirements: ['Computer Science', 'Data Science', 'Computer Engineering', 'Mathematics'],
    location: 'Maranello, Italy',
    workMode: 'On-site',
    jobLevel: 'Mid',
    openings: 1,
    noticePeriod: '30 days',
    languagesRequired: ['English'],
    salaryRange: '€50k–65k',
    summary: 'Data engineer building batch and streaming pipelines for race performance analytics.',
    candidates: [
      {
        fullName: 'Giulia Ferraro', gender: 'FEMALE', location: 'Turin, Italy', headline: 'Data Engineer',
        years: 4, skills: ['Python', 'SQL', 'Apache Spark', 'Kafka', 'AWS', 'Airflow', 'dbt', 'InfluxDB'],
        summary: 'Data engineer with 4 years building Spark and Kafka pipelines on AWS for sensor data.',
        experience: [
          { company: 'Stellantis Data Office', role: 'Data Engineer', from: 2021, to: null, bullets: ['Streaming pipeline for connected-car sensor data with Kafka + Spark Structured Streaming', 'Airflow + dbt models on AWS (S3, EMR, Redshift)', 'Time-series storage in InfluxDB for engineering dashboards'] },
        ],
        education: [{ degree: 'M.Sc', fieldOfStudy: 'Data Science', institution: 'Politecnico di Torino', startYear: 2019, endYear: 2021, grade: '110/110' }],
        projects: ['Formula 1 lap data analysis notebooks (PySpark)'],
        certifications: ['AWS Certified Data Analytics – Specialty'],
      },
      {
        fullName: 'Vikram Rao', gender: 'MALE', location: 'Hyderabad, India', headline: 'Data Engineer (GCP)',
        years: 3, skills: ['Python', 'SQL', 'Airflow', 'BigQuery', 'GCP', 'Apache Spark'],
        summary: 'Data engineer with 3 years on Python, Airflow and BigQuery; some Spark.',
        experience: [
          { company: 'Swiggy', role: 'Data Engineer', from: 2022, to: null, bullets: ['Airflow DAGs loading order data into BigQuery', 'Spark jobs on Dataproc for daily aggregates'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Science', institution: 'JNTU Hyderabad', startYear: 2017, endYear: 2021, grade: '8.0 CGPA' }],
        projects: [],
        certifications: ['Google Professional Data Engineer'],
      },
      {
        fullName: 'Elena Russo', gender: 'FEMALE', location: 'Milan, Italy', headline: 'Data Analyst',
        years: 2, skills: ['SQL', 'Python', 'Tableau', 'Excel', 'Pandas'],
        summary: 'Data analyst with 2 years of SQL and Python reporting; moving into data engineering.',
        experience: [
          { company: 'Pirelli', role: 'Data Analyst', from: 2023, to: null, bullets: ['Tyre-wear reports in SQL + Tableau', 'Automated weekly reports with Python and Pandas'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Mathematics', institution: 'University of Milan', startYear: 2019, endYear: 2022, grade: '105/110' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Arjun Menon', gender: 'MALE', location: 'Kochi, India', headline: 'Backend Engineer (Java + Kafka)',
        years: 5, skills: ['Java', 'Kafka', 'PostgreSQL', 'Spring Boot', 'AWS', 'SQL'],
        summary: 'Backend engineer with 5 years on Java services and Kafka event streaming.',
        experience: [
          { company: 'UST Global', role: 'Senior Backend Engineer', from: 2020, to: null, bullets: ['Kafka event streaming between payment microservices', 'AWS deployments with RDS PostgreSQL'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Engineering', institution: 'CUSAT', startYear: 2015, endYear: 2019, grade: '7.8 CGPA' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Pooja Reddy', gender: 'FEMALE', location: 'Chennai, India', headline: 'Data Science Graduate',
        years: 0, skills: ['Python', 'Pandas', 'scikit-learn', 'SQL', 'Machine Learning'],
        summary: 'Recent M.Sc Data Science graduate with internship and project experience in Python.',
        experience: [
          { company: 'Analytics Vidhya', role: 'Data Science Intern', from: 2025, to: 2025, bullets: ['Built churn models with scikit-learn'] },
        ],
        education: [{ degree: 'M.Sc', fieldOfStudy: 'Data Science', institution: 'Anna University', startYear: 2023, endYear: 2025, grade: '8.7 CGPA' }],
        projects: ['Lap-time prediction model (Python, scikit-learn)'],
        certifications: [],
      },
      {
        fullName: 'Daniel Moretti', gender: 'MALE', location: 'Parma, Italy', headline: 'Mechanical Design Engineer',
        years: 3, skills: ['MATLAB', 'SolidWorks', 'CAD', 'Excel'],
        summary: 'Mechanical engineer with 3 years in CAD design; uses MATLAB for test data.',
        experience: [
          { company: 'Brembo', role: 'Design Engineer', from: 2022, to: null, bullets: ['Brake caliper design in SolidWorks', 'Test-rig data analysis in MATLAB'] },
        ],
        education: [{ degree: 'B.Eng', fieldOfStudy: 'Mechanical Engineering', institution: 'University of Parma', startYear: 2018, endYear: 2021, grade: '100/110' }],
        projects: [],
        certifications: [],
      },
    ],
  },
  {
    client: 'McLaren',
    title: 'Embedded Software Engineer – Vehicle Control Systems',
    description: `McLaren Racing is hiring an Embedded Software Engineer to develop control software that runs
on the car's electronic control units.

Responsibilities:
- Develop and test embedded C/C++ software on real-time operating systems
- Implement CAN bus communication between ECUs
- Work with controls engineers to bring Simulink models onto hardware
- Support track testing and debug issues on the car

Requirements:
- 3+ years of embedded C/C++ development
- RTOS and CAN bus experience
- Embedded Linux

Nice to have:
- MATLAB/Simulink, AUTOSAR
- ISO 26262 / safety-critical development
- Python for test tooling`,
    minimumExperience: 3,
    maximumExperience: 8,
    requiredSkills: ['C', 'C++', 'RTOS', 'CAN bus', 'Embedded Linux'],
    preferredSkills: ['MATLAB/Simulink', 'AUTOSAR', 'ISO 26262', 'Python'],
    educationRequirements: ['Electronics Engineering', 'Electrical Engineering', 'Computer Engineering'],
    location: 'Woking, United Kingdom',
    workMode: 'On-site',
    jobLevel: 'Senior',
    openings: 1,
    noticePeriod: '90 days',
    languagesRequired: ['English'],
    salaryRange: '£50k–70k',
    summary: 'Embedded C/C++ engineer for real-time vehicle control software on race car ECUs.',
    candidates: [
      {
        fullName: 'Oliver Hughes', gender: 'MALE', location: 'Coventry, United Kingdom', headline: 'Senior Embedded Software Engineer (Automotive)',
        years: 6, skills: ['C', 'C++', 'AUTOSAR', 'CAN bus', 'RTOS', 'Embedded Linux', 'ISO 26262', 'MATLAB/Simulink', 'Python'],
        summary: 'Automotive embedded engineer with 6 years of safety-critical ECU software.',
        experience: [
          { company: 'Jaguar Land Rover', role: 'Senior Embedded Software Engineer', from: 2021, to: null, bullets: ['AUTOSAR Classic software for powertrain ECUs', 'CAN and CAN-FD communication stacks', 'ISO 26262 ASIL-C development and reviews'] },
          { company: 'Ricardo', role: 'Embedded Engineer', from: 2019, to: 2021, bullets: ['Auto-generated code from Simulink models onto RTOS targets'] },
        ],
        education: [{ degree: 'M.Eng', fieldOfStudy: 'Electronics Engineering', institution: 'University of Warwick', startYear: 2015, endYear: 2019, grade: 'First Class' }],
        projects: [],
        certifications: ['ISO 26262 Functional Safety Engineer (TÜV)'],
      },
      {
        fullName: 'Siddharth Iyer', gender: 'MALE', location: 'Bengaluru, India', headline: 'Embedded Software Engineer',
        years: 4, skills: ['C', 'C++', 'FreeRTOS', 'CAN bus', 'Embedded Linux', 'Python', 'STM32'],
        summary: 'Embedded engineer with 4 years of C/C++ on FreeRTOS and embedded Linux, drones and EVs.',
        experience: [
          { company: 'Ather Energy', role: 'Embedded Software Engineer', from: 2022, to: null, bullets: ['Motor-controller firmware on FreeRTOS (STM32)', 'CAN diagnostics between battery and vehicle ECUs'] },
          { company: 'ideaForge', role: 'Firmware Engineer', from: 2021, to: 2022, bullets: ['Flight-controller drivers on embedded Linux'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Electronics and Communication', institution: 'NIT Trichy', startYear: 2017, endYear: 2021, grade: '8.6 CGPA' }],
        projects: ['Formula Student car data logger (CAN, STM32)'],
        certifications: [],
      },
      {
        fullName: 'Emily Clarke', gender: 'FEMALE', location: 'Bristol, United Kingdom', headline: 'IoT Firmware Engineer',
        years: 3, skills: ['C', 'Zephyr RTOS', 'BLE', 'Python', 'I2C', 'SPI'],
        summary: 'Firmware engineer with 3 years of C on Zephyr RTOS for low-power IoT devices.',
        experience: [
          { company: 'Arm', role: 'Firmware Engineer', from: 2022, to: null, bullets: ['BLE sensor firmware on Zephyr RTOS', 'Python test harnesses for hardware-in-the-loop'] },
        ],
        education: [{ degree: 'B.Eng', fieldOfStudy: 'Electrical Engineering', institution: 'University of Bristol', startYear: 2019, endYear: 2022, grade: '2:1' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Harsh Vora', gender: 'MALE', location: 'Ahmedabad, India', headline: 'Controls Engineer (Simulink)',
        years: 2, skills: ['MATLAB/Simulink', 'Control Systems', 'C', 'Stateflow'],
        summary: 'Controls engineer with 2 years modelling vehicle dynamics in MATLAB/Simulink.',
        experience: [
          { company: 'Tata Elxsi', role: 'Controls Engineer', from: 2023, to: null, bullets: ['Vehicle dynamics and ABS models in Simulink + Stateflow', 'Code generation handed to the embedded team'] },
        ],
        education: [{ degree: 'B.E.', fieldOfStudy: 'Electrical Engineering', institution: 'L.D. College of Engineering', startYear: 2019, endYear: 2023, grade: '8.2 CGPA' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Thomas Wright', gender: 'MALE', location: 'Reading, United Kingdom', headline: 'C++ Software Engineer',
        years: 7, skills: ['C++', 'Qt', 'Linux', 'Python', 'Multithreading'],
        summary: 'C++ engineer with 7 years building Qt desktop applications on Linux.',
        experience: [
          { company: 'Thales UK', role: 'Senior C++ Engineer', from: 2018, to: null, bullets: ['Qt operator consoles on Linux', 'Multithreaded data processing in modern C++'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Computer Science', institution: 'University of Reading', startYear: 2014, endYear: 2017, grade: '2:1' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Ananya Das', gender: 'FEMALE', location: 'Kolkata, India', headline: 'Electronics Graduate',
        years: 0, skills: ['C', 'Arduino', 'Raspberry Pi', 'Python'],
        summary: 'Recent ECE graduate with hobby and college projects on Arduino and Raspberry Pi.',
        experience: [],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Electronics and Communication', institution: 'Jadavpur University', startYear: 2021, endYear: 2025, grade: '8.9 CGPA' }],
        projects: ['Line-following robot (Arduino, C)', 'Home weather station (Raspberry Pi, Python)'],
        certifications: [],
      },
    ],
  },
  {
    client: 'McLaren',
    title: 'Frontend Developer – Fan Engagement App',
    description: `McLaren Racing is building a new fan engagement web app — live race companion, team content
and member perks — and needs a Frontend Developer to help ship it.

Responsibilities:
- Build fast, accessible pages in React, TypeScript and Next.js
- Turn designs into polished, responsive UI
- Work with backend engineers on GraphQL APIs
- Write tests and keep quality high

Requirements:
- 2+ years with React and TypeScript in production
- Next.js, HTML and CSS

Nice to have:
- Tailwind CSS, GraphQL
- Jest / React Testing Library
- Web accessibility (WCAG)`,
    minimumExperience: 2,
    maximumExperience: 5,
    requiredSkills: ['React', 'TypeScript', 'Next.js', 'HTML', 'CSS'],
    preferredSkills: ['Tailwind CSS', 'GraphQL', 'Jest', 'Accessibility'],
    educationRequirements: ['Computer Science', 'Information Technology', 'Computer Engineering'],
    location: 'London, United Kingdom',
    workMode: 'Hybrid',
    jobLevel: 'Mid',
    openings: 2,
    noticePeriod: '30 days',
    languagesRequired: ['English'],
    salaryRange: '£45k–60k',
    summary: 'React/Next.js frontend developer for a fan engagement web app.',
    candidates: [
      {
        fullName: 'Chloe Bennett', gender: 'FEMALE', location: 'London, United Kingdom', headline: 'Frontend Engineer (Next.js)',
        years: 4, skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS', 'GraphQL', 'Jest', 'Accessibility', 'HTML', 'CSS'],
        summary: 'Frontend engineer with 4 years shipping Next.js + TypeScript consumer apps with strong accessibility.',
        experience: [
          { company: 'Sky Sports', role: 'Frontend Engineer', from: 2022, to: null, bullets: ['Live match centre in Next.js + TypeScript serving 2M weekly users', 'GraphQL data layer and Tailwind design system', 'Led WCAG 2.1 AA accessibility fixes'] },
          { company: 'Deliveroo', role: 'Frontend Developer', from: 2021, to: 2022, bullets: ['React checkout flow with Jest + React Testing Library'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Computer Science', institution: 'University College London', startYear: 2017, endYear: 2020, grade: 'First Class' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Kabir Malhotra', gender: 'MALE', location: 'Gurugram, India', headline: 'React Developer',
        years: 3, skills: ['React', 'TypeScript', 'Redux', 'Jest', 'HTML', 'CSS', 'Next.js'],
        summary: 'React developer with 3 years of TypeScript; one production Next.js project.',
        experience: [
          { company: 'Zomato', role: 'Frontend Developer', from: 2022, to: null, bullets: ['Restaurant dashboard in React + TypeScript + Redux', 'Migrated the marketing site to Next.js'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Information Technology', institution: 'DTU Delhi', startYear: 2018, endYear: 2022, grade: '8.3 CGPA' }],
        projects: ['F1 standings tracker (Next.js, Ergast API)'],
        certifications: [],
      },
      {
        fullName: 'Isabella Turner', gender: 'FEMALE', location: 'Manchester, United Kingdom', headline: 'Frontend Developer (Vue.js)',
        years: 2, skills: ['Vue.js', 'JavaScript', 'Nuxt', 'HTML', 'CSS', 'SCSS'],
        summary: 'Frontend developer with 2 years of Vue.js and Nuxt; learning React.',
        experience: [
          { company: 'Booking.com', role: 'Frontend Developer', from: 2023, to: null, bullets: ['Vue.js search filters and Nuxt landing pages'] },
        ],
        education: [{ degree: 'B.Sc', fieldOfStudy: 'Computer Science', institution: 'University of Manchester', startYear: 2019, endYear: 2022, grade: '2:1' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Nikhil Jain', gender: 'MALE', location: 'Jaipur, India', headline: 'React Native Developer',
        years: 5, skills: ['React Native', 'React', 'JavaScript', 'TypeScript', 'Redux', 'Firebase'],
        summary: 'Mobile developer with 5 years of React Native; some React web work.',
        experience: [
          { company: 'Dream11', role: 'Senior React Native Developer', from: 2020, to: null, bullets: ['Fantasy sports app screens in React Native + TypeScript', 'Push notifications with Firebase'] },
        ],
        education: [{ degree: 'B.Tech', fieldOfStudy: 'Computer Engineering', institution: 'MNIT Jaipur', startYear: 2015, endYear: 2019, grade: '7.6 CGPA' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Sam Wilson', gender: 'MALE', location: 'Leeds, United Kingdom', headline: 'WordPress Developer',
        years: 1, skills: ['WordPress', 'PHP', 'HTML', 'CSS', 'jQuery'],
        summary: 'Web developer with 1 year building WordPress themes for small businesses.',
        experience: [
          { company: 'Pixel Agency', role: 'WordPress Developer', from: 2024, to: null, bullets: ['Custom WordPress themes in PHP, HTML, CSS and jQuery'] },
        ],
        education: [{ degree: 'HND', fieldOfStudy: 'Computing', institution: 'Leeds City College', startYear: 2021, endYear: 2023, grade: 'Merit' }],
        projects: [],
        certifications: [],
      },
      {
        fullName: 'Tanvi Shah', gender: 'FEMALE', location: 'Mumbai, India', headline: 'UI/UX Designer',
        years: 3, skills: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'HTML', 'CSS'],
        summary: 'Product designer with 3 years in Figma; basic HTML/CSS.',
        experience: [
          { company: 'CRED', role: 'Product Designer', from: 2022, to: null, bullets: ['Designed rewards flows in Figma', 'Ran usability tests with 50+ users'] },
        ],
        education: [{ degree: 'B.Des', fieldOfStudy: 'Interaction Design', institution: 'NID Ahmedabad', startYear: 2018, endYear: 2022, grade: '8.0 CGPA' }],
        projects: [],
        certifications: [],
      },
    ],
  },
];

const slugify = (s) => s.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');
const yearsLabel = (e) => `${e.from} – ${e.to ?? 'Present'}`;

function resumeLines(c, email, phone) {
  const lines = [c.fullName, c.headline, `${email}  |  ${phone}  |  ${c.location}`, '', 'SUMMARY', c.summary, '', 'SKILLS', c.skills.join(', ')];
  if (c.experience.length) {
    lines.push('', 'EXPERIENCE');
    for (const e of c.experience) {
      lines.push(`${e.role} — ${e.company} (${yearsLabel(e)})`);
      e.bullets.forEach((b) => lines.push(`- ${b}`));
    }
  }
  if (c.projects.length) lines.push('', 'PROJECTS', ...c.projects.map((p) => `- ${p}`));
  lines.push('', 'EDUCATION', ...c.education.map((ed) => `${ed.degree} in ${ed.fieldOfStudy} — ${ed.institution} (${ed.startYear}–${ed.endYear}), ${ed.grade}`));
  if (c.certifications.length) lines.push('', 'CERTIFICATIONS', ...c.certifications);
  return lines;
}

function parsedData(c, email, phone) {
  const ed = c.education[0];
  return {
    name: c.fullName,
    email,
    phone,
    skills: c.skills,
    experience: c.experience.map((e) => ({ company: e.company, role: e.role, duration: yearsLabel(e) })),
    education: c.education.map((e) => ({ degree: e.degree, field: e.fieldOfStudy })),
    projects: c.projects,
    certifications: c.certifications,
    totalExperienceYears: c.years,
    university: ed.institution,
    college: ed.institution,
    degree: `${ed.degree} in ${ed.fieldOfStudy}`,
    spi: null,
    gender: '',
  };
}

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: AGENCY_EMAIL } });
  if (!owner) throw new Error(`${AGENCY_EMAIL} not found`);
  const agency = await prisma.company.findFirst({ where: { userId: owner.id } });
  if (!agency) throw new Error(`No agency owned by ${AGENCY_EMAIL}`);
  const clients = await prisma.clientCompany.findMany({
    where: { companyId: agency.id },
    include: { departments: true, hiringPersons: true },
  });

  // Re-runnable: remove this script's previous jobs, fake candidates and their CV blobs.
  await prisma.job.deleteMany({ where: { companyId: agency.id, title: { in: JOBS.map((j) => j.title) } } });
  const oldResumes = await prisma.resume.findMany({
    where: { candidate: { user: { email: { endsWith: `@${DOMAIN}` } } } },
    select: { storageKey: true },
  });
  await prisma.user.deleteMany({ where: { email: { endsWith: `@${DOMAIN}` } } });
  await prisma.resumeBlob.deleteMany({ where: { id: { in: oldResumes.map((r) => r.storageKey) } } });

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let phoneSeq = 9810000100;
  let total = 0;

  for (const [jobIndex, j] of JOBS.entries()) {
    const client = clients.find((c) => c.name.toLowerCase() === j.client.toLowerCase());
    if (!client) throw new Error(`Client "${j.client}" not found under ${agency.name}`);
    const hr = client.hiringPersons[0] ?? null;
    const departmentId = hr?.departmentId ?? client.departments[0]?.id ?? null;

    const job = await prisma.job.create({
      data: {
        companyId: agency.id,
        createdBy: owner.id,
        title: j.title,
        description: j.description,
        minimumExperience: j.minimumExperience,
        maximumExperience: j.maximumExperience,
        requiredSkills: j.requiredSkills,
        preferredSkills: j.preferredSkills,
        educationRequirements: j.educationRequirements,
        location: j.location,
        employmentType: 'FULL_TIME',
        workMode: j.workMode,
        openings: j.openings,
        jobLevel: j.jobLevel,
        noticePeriod: j.noticePeriod,
        languagesRequired: j.languagesRequired,
        salaryRange: j.salaryRange,
        status: 'OPEN',
        minAcceptableScore: 70,
        clientCompanyId: client.id,
        departmentId,
        hiringPersonId: hr?.id ?? null,
        createdAt: new Date(Date.now() - (14 - jobIndex * 2) * DAY),
        structuredRequirements: {
          requiredSkills: j.requiredSkills,
          preferredSkills: j.preferredSkills,
          minimumExperience: j.minimumExperience,
          maximumExperience: j.maximumExperience,
          education: j.educationRequirements,
          summary: j.summary,
        },
      },
    });
    console.log(`\n${client.name} → ${j.title}  (HR: ${hr?.fullName ?? '—'})`);

    for (const [i, c] of j.candidates.entries()) {
      const email = `${slugify(c.fullName)}@${DOMAIN}`;
      const phone = `+91${phoneSeq++}`;
      const appliedAt = new Date(Date.now() - (10 - jobIndex * 2 - i) * DAY - i * 3600 * 1000);
      const docx = buildDocx(resumeLines(c, email, phone));
      const blob = await prisma.resumeBlob.create({ data: { data: docx } });
      const fileName = `${slugify(c.fullName).replace(/\./g, '_')}_cv.docx`;

      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'CANDIDATE',
          candidate: {
            create: {
              fullName: c.fullName,
              phone,
              location: c.location,
              headline: c.headline,
              skills: c.skills,
              gender: c.gender,
              educations: { create: c.education.map((e) => ({ ...e, isCurrentlyStudying: false })) },
              resumes: {
                create: {
                  fileName,
                  fileType: DOCX_MIME,
                  fileSize: docx.length,
                  storageKey: blob.id,
                  rawText: resumeLines(c, email, phone).join('\n'),
                  parsedData: parsedData(c, email, phone),
                  isPrimary: true,
                  createdAt: appliedAt,
                },
              },
            },
          },
        },
      });
      const candidate = await prisma.candidate.findFirst({ where: { user: { email } }, include: { resumes: true } });
      await prisma.application.create({
        data: { candidateId: candidate.id, jobId: job.id, resumeId: candidate.resumes[0].id, status: 'APPLIED', createdAt: appliedAt },
      });
      total++;
      console.log(`  + ${c.fullName.padEnd(16)} ${String(c.years).padStart(3)} yrs  ${c.headline}`);
    }
  }

  console.log(`\nCreated ${JOBS.length} jobs and ${total} applicants for ${agency.name}.`);
  console.log(`Candidate logins: <first>.<last>@${DOMAIN} / ${PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
