 INSERT INTO asset_identifiers (asset_id, type, value)                                                                                                        
  SELECT id, 'GOOGLE_SYMBOL', 'LON:ADM'                                                                                                                        
  FROM assets
  WHERE name = 'ADM Shares';   