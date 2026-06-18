-- ============================================================
-- Migration 013: Seed market retail prices for Cindy Pharm medications
-- Based on typical Ghana community pharmacy retail prices (GHS, 2025)
-- ============================================================

UPDATE medications_master SET selling_price = CASE name
  -- Tablets & Capsules
  WHEN 'Gebedol Tablets'                        THEN 6.00
  WHEN 'Ciprolex-TZ Tablets'                    THEN 35.00
  WHEN 'Paracetamol 500 mg Tablets'             THEN 5.00
  WHEN 'M-Z Tone Tablets'                       THEN 20.00
  WHEN 'Zyfen 120 mg Tablets'                   THEN 28.00
  WHEN 'Hycid Capsules'                         THEN 15.00
  WHEN 'Letacam'                                THEN 15.00
  WHEN 'Losartan 100 mg Tablets'                THEN 20.00
  WHEN 'Amlova 10 mg Tablets'                   THEN 12.00
  WHEN 'Vermox 500 mg Tablets'                  THEN 12.00
  WHEN 'Doxy Tablets'                           THEN 12.00
  WHEN 'Oxytetra 250 mg Capsules'               THEN 10.00
  WHEN 'Ronfit Forte Capsules'                  THEN 18.00
  WHEN 'Nifecard XL 30 mg Tablets'              THEN 20.00
  WHEN 'Zintab 10 mg Tablets'                   THEN 8.00
  WHEN 'Sermens Capsules'                       THEN 15.00
  WHEN 'Amoksiklav 625 mg Tablets'              THEN 60.00
  WHEN 'Dexone Tablets'                         THEN 8.00
  WHEN 'Celecoxib 200 mg'                       THEN 25.00
  WHEN 'Lifetone Capsules'                      THEN 20.00
  WHEN 'Polyfer Capsules'                       THEN 15.00
  WHEN 'Amciclox Capsules'                      THEN 12.00
  WHEN 'Prednisolone 5 mg Tablets'              THEN 8.00
  WHEN 'Citroc Tablets'                         THEN 12.00
  WHEN 'Wormzap Suspension/Tablets'             THEN 8.00
  WHEN 'Primolut N 5 mg Tablets'                THEN 20.00
  WHEN 'Buscopan Tablets'                       THEN 20.00
  WHEN 'Ginovil Tablets'                        THEN 18.00
  WHEN 'Metrolife F Tablets'                    THEN 12.00
  WHEN 'Rhizin Tablets'                         THEN 8.00
  WHEN 'Loperon (Loperamide) Capsules'          THEN 8.00
  WHEN 'Novacip (Ciprofloxacin) Tablets'        THEN 30.00
  WHEN 'Zulu-100 mg Tablets'                    THEN 15.00
  WHEN 'Enaphage 500 mg Tablets'                THEN 12.00
  WHEN 'Enacin (Clindamycin) 300 mg Capsules'   THEN 40.00
  WHEN 'Chloramphenicol Capsules'               THEN 10.00
  WHEN 'Broncholin Tablets'                     THEN 12.00
  WHEN 'Diclodenk 100 mg Tablets'               THEN 12.00
  WHEN 'Ibuga Capsules'                         THEN 8.00
  WHEN 'Coldrilif Capsules'                     THEN 12.00
  WHEN 'Ronluz 100 Tablets'                     THEN 12.00
  -- Syrups / Mixtures
  WHEN 'Zincovit Syrup 200 ml'                  THEN 30.00
  WHEN 'Auntie Mary Gripe Water'                THEN 20.00
  WHEN 'Heptolif Syrup'                         THEN 35.00
  WHEN 'Coldrilif Syrup'                        THEN 18.00
  WHEN 'Teedar Syrup'                           THEN 20.00
  WHEN 'Hoffexa Syrup'                          THEN 22.00
  WHEN 'Babyvite Syrup'                         THEN 20.00
  WHEN 'Apetamin Syrup'                         THEN 35.00
  WHEN 'Enafen (Ibuprofen) Syrup'               THEN 18.00
  WHEN 'Salocold Syrup'                         THEN 18.00
  WHEN 'Victory G Mixture'                      THEN 20.00
  WHEN 'Tres Orix Forte Syrup'                  THEN 35.00
  WHEN 'Ayitone Forte Syrup'                    THEN 30.00
  WHEN 'Polygrow Syrup'                         THEN 30.00
  WHEN 'Fluxacin Suspension'                    THEN 45.00
  WHEN 'Becoatin Syrup'                         THEN 20.00
  WHEN 'Baby Cough Linctus'                     THEN 18.00
  WHEN 'Phizin Syrup'                           THEN 18.00
  WHEN 'Premoxyl (Amoxicillin) Suspension'      THEN 35.00
  WHEN 'Macacid Syrup'                          THEN 18.00
  WHEN 'Zetalin Syrup'                          THEN 18.00
  WHEN 'Samalin Junior Syrup'                   THEN 22.00
  WHEN 'Promecine Syrup'                        THEN 20.00
  WHEN 'Visco-F Syrup'                          THEN 25.00
  WHEN 'Abicof Adult'                           THEN 28.00
  WHEN 'Amicof Junior'                          THEN 22.00
  WHEN 'Flemex Adult'                           THEN 28.00
  WHEN 'Lubes Cough Mixture'                    THEN 22.00
  WHEN 'Grofyn Tonic'                           THEN 25.00
  WHEN 'Haemoglobin Syrup'                      THEN 35.00
  WHEN 'Efpae Junior Syrup'                     THEN 22.00
  WHEN 'Taabea Herbal Mixture'                  THEN 20.00
  WHEN 'Time Herbal Mixture'                    THEN 20.00
  WHEN 'Adusa Mixture'                          THEN 18.00
  WHEN 'Givers Mixture'                         THEN 18.00
  WHEN 'Amcof Senior'                           THEN 28.00
  WHEN 'Amcof Junior'                           THEN 22.00
  WHEN 'Amcof Baby'                             THEN 20.00
  WHEN 'MMT'                                    THEN 20.00
  WHEN 'Mucotin Adult'                          THEN 25.00
  WHEN 'Arfan Suspension'                       THEN 40.00
  -- Antibiotics / Drops
  WHEN 'Amok Lavi 228'                          THEN 55.00
  WHEN 'Amok Lavi 457'                          THEN 70.00
  WHEN 'Cefuroxime Suspension 50 ml'            THEN 65.00
  WHEN 'Cefuroxime 750 mg Injection'            THEN 55.00
  WHEN 'Amciclox Suspension'                    THEN 35.00
  WHEN 'Ciprolex Ear/Eye Drops'                 THEN 25.00
  WHEN 'Chlo Ear Drops'                         THEN 20.00
  WHEN 'Klaro Eye Drops'                        THEN 20.00
  WHEN 'Gent Drops'                             THEN 20.00
  -- Antimalarials
  WHEN 'Lonart DS'                              THEN 35.00
  WHEN 'Lufart DS'                              THEN 30.00
  WHEN 'Lonart Suspension'                      THEN 28.00
  WHEN 'Lufart Suspension'                      THEN 25.00
  WHEN 'Artesunate Injection 30 mg'             THEN 45.00
  WHEN 'Gesunate 60 Injection'                  THEN 55.00
  -- Creams & Ointments
  WHEN 'Ketazol Cream 30 g'                     THEN 22.00
  WHEN 'Mizolplus Cream'                        THEN 20.00
  WHEN 'Herbasoul Cream'                        THEN 20.00
  WHEN 'Hydrocortisone Cream 15 g'              THEN 12.00
  WHEN 'Funbact Cream Original'                 THEN 28.00
  WHEN 'Epiderm Cream 15 g'                     THEN 15.00
  WHEN 'Epiderm Cream 30 g'                     THEN 22.00
  WHEN 'Drez Ointment 10 g'                     THEN 12.00
  WHEN 'Drez Ointment 30 g'                     THEN 18.00
  WHEN 'Joy Ointment'                           THEN 15.00
  WHEN 'Congo Ointment (Small)'                 THEN 12.00
  WHEN 'NBA Balm'                               THEN 12.00
  WHEN 'Chilly Gel'                             THEN 15.00
  WHEN 'Protector'                              THEN 15.00
  WHEN 'Medisoft Repellent'                     THEN 15.00
  -- Suppositories
  WHEN 'Diclodenk Rectal Suppositories'         THEN 20.00
  WHEN 'Lofnac 100 Suppositories'               THEN 28.00
  -- Women's Health
  WHEN 'Klovinal Pessaries'                     THEN 35.00
  WHEN 'H1 Lady Wash'                           THEN 20.00
  WHEN 'Condom Ebony'                           THEN 8.00
  -- Vitamins & Supplements
  WHEN 'Wellwoman Original'                     THEN 120.00
  WHEN 'Tothema Ampoules'                       THEN 20.00
  WHEN 'Zincovit Tablets'                       THEN 30.00
  -- Medical Supplies
  WHEN 'Cotton Wool 200 g'                      THEN 18.00
  WHEN 'Gauze Bandage 1 inch'                   THEN 8.00
  WHEN 'Gauze Bandage 3 inch'                   THEN 12.00
  WHEN 'Fabric Plaster Strips'                  THEN 12.00
  WHEN 'Syringe 2 cc + Needle'                  THEN 4.00
  WHEN 'Syringe 10 cc + Needle 21G'             THEN 6.00
  WHEN 'Test Kit Cassette'                      THEN 10.00
  -- Other Products
  WHEN 'Dragon Spray'                           THEN 30.00
  WHEN 'Chicho Soap'                            THEN 12.00
  WHEN 'Tetmosol Soap'                          THEN 15.00
  WHEN 'Kamaclox Mouth Wash'                    THEN 20.00
  WHEN 'Listerine 250 ml'                       THEN 45.00
  WHEN 'Bonamol Inhaler'                        THEN 35.00
  WHEN 'Picool Inhaler'                         THEN 35.00
  WHEN 'Redsun Jelly'                           THEN 12.00
  WHEN 'Redsun 100 Tablets'                     THEN 20.00
  WHEN 'Shal Toux Lozenges'                     THEN 12.00
  WHEN 'Romaf Lozenges'                         THEN 12.00
  WHEN 'Liver Salt'                             THEN 8.00
  WHEN 'Amuzu Pee'                              THEN 15.00
  WHEN 'Amuzu Garlic'                           THEN 15.00
  WHEN 'Mist Potcit'                            THEN 15.00
  WHEN 'Mist Fac.'                              THEN 15.00
  ELSE selling_price
END
WHERE organization_id = '3c51cf2f-26d9-42f9-9f7b-bc297c70a775';
