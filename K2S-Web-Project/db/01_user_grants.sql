-- K2S Web Project - MySQL User & Grants (Least Privilege)
-- Use for runtime app access only. For migrations, use a separate admin user.

CREATE USER IF NOT EXISTS 'l12'@'localhost' IDENTIFIED BY 'laravel12';

GRANT SELECT, INSERT, UPDATE, DELETE
  ON k2s_p1.*
  TO 'l12'@'localhost';

FLUSH PRIVILEGES;
