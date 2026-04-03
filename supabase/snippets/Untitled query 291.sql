 WITH                                                                                                                                                         
    ptf AS (SELECT id FROM portfolios WHERE type = 'ADM' LIMIT 1),
    ast AS (SELECT asset_id AS id FROM asset_identifiers WHERE value = 'GB00B02J6398')                                                                         
  INSERT INTO share_grants (portfolio_id, asset_id, share_type, grant_date, vesting_date, granted_quantity, status)
  SELECT ptf.id, ast.id, g.stype, g.gdate::date, g.vdate::date, g.qty, 'unvested'                                                                              
  FROM ptf, ast,                                                                                                                                               
  (VALUES                                                                                                                                                      
    -- DFSS grants                                                                                                                                             
    ('DFSS', '2025-09-10', '2028-09-10', 1250),                 
    ('DFSS', '2025-09-10', '2028-09-10', 1250),                                                                                                                
    ('DFSS', '2024-10-01', '2027-10-01', 1250),
    ('DFSS', '2024-10-01', '2027-10-01', 1250),                                                                                                                
    ('DFSS', '2023-09-28', '2026-09-28', 1250),                 
    ('DFSS', '2023-09-28', '2026-09-28', 1250),                                                                                                                
    ('DFSS', '2022-09-22', '2025-09-22', 250),  -- vesting date PAST: vest or lapse
    ('DFSS', '2022-09-22', '2025-09-22', 250),  -- vesting date PAST: vest or lapse                                                                            
    -- AFSS grants                                              
    ('AFSS', '2024-08-20', '2027-08-20', 62),                                                                                                                  
    ('AFSS', '2024-03-11', '2027-03-11', 69),                                                                                                                  
    ('AFSS', '2023-08-21', '2026-08-21', 77),
    ('AFSS', '2025-03-13', '2028-03-13', 59),                                                                                                                  
    ('AFSS', '2025-08-21', '2028-08-21', 50)                    
  ) AS g(stype, gdate, vdate, qty);         