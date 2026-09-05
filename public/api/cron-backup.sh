#!/bin/bash
# PODMEI — jobs de cron (HostGator)
# Instale no cPanel > Avançado > Cron Jobs
#
# Meia-noite (Brasília, se o servidor já estiver em America/Sao_Paulo):
#   0 0 * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php
#
# Se o servidor estiver em UTC (00:00 BRT = 03:00 UTC):
#   0 3 * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php
#
# Rede de segurança a cada hora (só grava 1x por dia):
#   5 * * * * /usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php

/usr/local/bin/php /home1/jricon98/podmei.com/api/backup-diario.php
