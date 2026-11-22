CREATE DATABASE IF NOT EXISTS pharmacy_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE pharmacy_db;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','pharmacist','staff') NOT NULL DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  contact_person VARCHAR(120),
  phone VARCHAR(20),
  city VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(140) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(160),
  city VARCHAR(80),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  generic_name VARCHAR(180) NOT NULL,
  category VARCHAR(100),
  strength VARCHAR(80),
  dosage_form VARCHAR(80),
  requires_prescription BOOLEAN NOT NULL DEFAULT FALSE,
  manufacturer VARCHAR(140),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medicine_id INT NOT NULL,
  supplier_id INT NULL,
  batch_number VARCHAR(80) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 20,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  expiry_date DATE NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_inventory_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT fk_inventory_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_number VARCHAR(40) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  doctor_name VARCHAR(140) NOT NULL,
  prescription_date DATE NOT NULL,
  notes TEXT,
  status ENUM('pending','dispensed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_prescription_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  medicine_id INT NOT NULL,
  quantity INT NOT NULL,
  instructions VARCHAR(255),
  CONSTRAINT fk_item_prescription FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id)
);

INSERT IGNORE INTO suppliers (id,name,contact_person,phone,city) VALUES
(1,'Sharma Medical Distributors','Rohit Sharma','9876543210','Jaipur'),
(2,'Aarogya Pharma Wholesale','Priya Mehta','9876501234','Delhi'),
(3,'Bharat Medicos Supply','Amit Verma','9810012345','Gurugram');

INSERT IGNORE INTO customers (id,full_name,phone,email,city) VALUES
(1,'Aarav Sharma','9876543211','aarav@example.in','Jaipur'),
(2,'Ananya Gupta','9876543212','ananya@example.in','Delhi'),
(3,'Rohan Mehta','9876543213','rohan@example.in','Alwar'),
(4,'Priya Singh','9876543214','priya@example.in','Gurugram'),
(5,'Ishita Verma','9876543215','ishita@example.in','Jaipur');

INSERT IGNORE INTO medicines
(id,name,generic_name,category,strength,dosage_form,requires_prescription,manufacturer) VALUES
(1,'Dolo 650','Paracetamol','Analgesic / Antipyretic','650 mg','Tablet',FALSE,'Micro Labs'),
(2,'Crocin 500','Paracetamol','Analgesic / Antipyretic','500 mg','Tablet',FALSE,'Haleon'),
(3,'Cetirizine 10','Cetirizine','Antihistamine','10 mg','Tablet',FALSE,'Generic'),
(4,'ORS Powder','Oral Rehydration Salts','Electrolyte','WHO formula','Sachet',FALSE,'Generic'),
(5,'Pantoprazole 40','Pantoprazole','Gastrointestinal','40 mg','Tablet',TRUE,'Generic'),
(6,'Amoxicillin 500','Amoxicillin','Antibiotic','500 mg','Capsule',TRUE,'Generic'),
(7,'Azithromycin 500','Azithromycin','Antibiotic','500 mg','Tablet',TRUE,'Generic'),
(8,'Metformin 500','Metformin','Antidiabetic','500 mg','Tablet',TRUE,'Generic'),
(9,'Amlodipine 5','Amlodipine','Antihypertensive','5 mg','Tablet',TRUE,'Generic'),
(10,'Vitamin C 500','Ascorbic Acid','Vitamin / Supplement','500 mg','Tablet',FALSE,'Generic'),
(11,'Ibuprofen 400','Ibuprofen','NSAID','400 mg','Tablet',TRUE,'Generic'),
(12,'Levocetirizine 5','Levocetirizine','Antihistamine','5 mg','Tablet',TRUE,'Generic');

INSERT IGNORE INTO inventory
(id,medicine_id,supplier_id,batch_number,quantity,reorder_level,purchase_price,selling_price,expiry_date) VALUES
(1,1,1,'DL650-2401',140,30,1.80,2.50,'2027-12-31'),
(2,2,1,'CR500-2402',85,25,1.20,1.80,'2027-10-31'),
(3,3,2,'CTZ10-2403',18,25,1.00,1.50,'2027-08-31'),
(4,4,3,'ORS-2404',60,20,12.00,18.00,'2027-11-30'),
(5,5,2,'PNT40-2405',42,20,4.50,6.00,'2027-09-30'),
(6,6,3,'AMX500-2406',24,20,5.00,7.00,'2027-06-30'),
(7,7,1,'AZT500-2407',12,20,8.00,11.00,'2027-07-31'),
(8,8,2,'MET500-2408',100,25,2.00,3.00,'2028-01-31'),
(9,9,2,'AML5-2409',75,20,1.50,2.20,'2027-12-31'),
(10,10,1,'VTC500-2410',55,20,2.00,3.00,'2027-10-31'),
(11,11,3,'IBU400-2411',9,20,2.50,3.50,'2027-05-31'),
(12,12,1,'LVC5-2412',31,15,2.00,3.00,'2027-09-30');

INSERT IGNORE INTO prescriptions
(id,prescription_number,customer_id,doctor_name,prescription_date,notes,status) VALUES
(1,'RX-2026-001',1,'Dr. Neha Kapoor','2026-10-20','Demo record only','pending'),
(2,'RX-2026-002',2,'Dr. Arjun Rao','2026-10-19','Demo record only','dispensed');

INSERT IGNORE INTO prescription_items (id,prescription_id,medicine_id,quantity,instructions) VALUES
(1,1,5,10,'As written on the original prescription'),
(2,2,8,30,'As written on the original prescription');
