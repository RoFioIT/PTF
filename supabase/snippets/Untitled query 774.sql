 -- ============================================================
-- Cash Accounts — Historical Balance Import                                                                      
  -- Run in Supabase SQL editor.                                                                                    
  -- Replace the 0 values with real balances.
  -- Duplicate the entire block for each quarter you want to import.                                                
  -- ON CONFLICT: safe to re-run — updates existing values.     ───────────────────────────────                   ──
  -- ============================================================                                                   
                                                                                                                    
  WITH acct AS (                                                                                                    
    SELECT id, name                                                                                                 
    FROM cash_accounts                                                                                              
    WHERE user_id = '268dbb82-ef5d-4a89-b0f7-9de1081d86e8'
  )                                                                                                                 
  INSERT INTO cash_account_snapshots (account_id, quarter, balance)                                                 
  VALUES                                                                                                            
    -- ── Studio 
  ((SELECT id FROM acct WHERE name = 'ING Joint'),'2017-Q1',1851),  	 ((SELECT id FROM acct WHERE name = 'ING Joint'),'2017-Q2',1851),  	 ((SELECT id FROM acct WHERE name = 'ING Joint'),'2017-Q3',1851),  	 ((SELECT id FROM acct WHERE name = 'ING Joint'),'2017-Q4',2883),  
 ((SELECT id FROM acct WHERE name = 'HSBC Joint'),'2017-Q1',1107),  	 ((SELECT id FROM acct WHERE name = 'HSBC Joint'),'2017-Q2',1107),  	 ((SELECT id FROM acct WHERE name = 'HSBC Joint'),'2017-Q3',1107),  	 ((SELECT id FROM acct WHERE name = 'HSBC Joint'),'2017-Q4',4792),  
 ((SELECT id FROM acct WHERE name = 'ING Titre'),'2017-Q1',4000),  	 ((SELECT id FROM acct WHERE name = 'ING Titre'),'2017-Q2',4000),  	 ((SELECT id FROM acct WHERE name = 'ING Titre'),'2017-Q3',4000),  	 ((SELECT id FROM acct WHERE name = 'ING Titre'),'2017-Q4',4000),  
 ((SELECT id FROM acct WHERE name = 'Livret A Silvia'),'2017-Q1',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Silvia'),'2017-Q2',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Silvia'),'2017-Q3',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Silvia'),'2017-Q4',5000),  
 ((SELECT id FROM acct WHERE name = 'Livret A Roberto'),'2017-Q1',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Roberto'),'2017-Q2',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Roberto'),'2017-Q3',0),  	 ((SELECT id FROM acct WHERE name = 'Livret A Roberto'),'2017-Q4',5000),  
 ((SELECT id FROM acct WHERE name = 'Assurance Silvia'),'2017-Q1',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Silvia'),'2017-Q2',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Silvia'),'2017-Q3',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Silvia'),'2017-Q4',15000),  
 ((SELECT id FROM acct WHERE name = 'Assurance Roberto'),'2017-Q1',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Roberto'),'2017-Q2',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Roberto'),'2017-Q3',0),  	 ((SELECT id FROM acct WHERE name = 'Assurance Roberto'),'2017-Q4',16000),  
 ((SELECT id FROM acct WHERE name = 'FICP Inv'),'2017-Q1',0),  	 ((SELECT id FROM acct WHERE name = 'FICP Inv'),'2017-Q2',0),  	 ((SELECT id FROM acct WHERE name = 'FICP Inv'),'2017-Q3',0),  	 ((SELECT id FROM acct WHERE name = 'FICP Inv'),'2017-Q4',5000),  
 ((SELECT id FROM acct WHERE name = 'ING ROB'),'2017-Q1',38184),  	 ((SELECT id FROM acct WHERE name = 'ING ROB'),'2017-Q2',38184),  	 ((SELECT id FROM acct WHERE name = 'ING ROB'),'2017-Q3',38184),  	 ((SELECT id FROM acct WHERE name = 'ING ROB'),'2017-Q4',26756),  
 ((SELECT id FROM acct WHERE name = 'HSBC Silvia'),'2017-Q1',34400),  	 ((SELECT id FROM acct WHERE name = 'HSBC Silvia'),'2017-Q2',34400),  	 ((SELECT id FROM acct WHERE name = 'HSBC Silvia'),'2017-Q3',34400),  	 ((SELECT id FROM acct WHERE name = 'HSBC Silvia'),'2017-Q4',22147)
  ON CONFLICT (account_id, quarter)                                                                                 
  DO UPDATE SET balance = EXCLUDED.balance;                                                                         
                                                  