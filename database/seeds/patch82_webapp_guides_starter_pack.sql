-- Smart Assistance - Patch 82 WebApp Guides Starter Pack
-- Idempotent seed: update by title/name, insert when missing

BEGIN;

DO $do$
DECLARE
  t text;
  title_col text;
  content_col text;
  subtitle_col text;
  category_col text;
  active_col text;
  order_col text;
  icon_col text;
  created_at_col text;
  updated_at_col text;
  g record;
  updated_rows integer;
  set_sql text;
  cols_sql text;
  vals_sql text;
BEGIN
  SELECT CASE
    WHEN to_regclass('public.webapp_guides') IS NOT NULL THEN 'webapp_guides'
    WHEN to_regclass('public.guides') IS NOT NULL THEN 'guides'
    ELSE NULL
  END INTO t;

  IF t IS NULL THEN
    RAISE EXCEPTION 'Tabella guide non trovata';
  END IF;

  SELECT column_name INTO title_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('title','name')
  ORDER BY CASE column_name WHEN 'title' THEN 1 ELSE 2 END
  LIMIT 1;

  SELECT column_name INTO content_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('content','body','text','guide_text','description')
  ORDER BY CASE column_name
    WHEN 'content' THEN 1
    WHEN 'body' THEN 2
    WHEN 'text' THEN 3
    WHEN 'guide_text' THEN 4
    ELSE 5
  END
  LIMIT 1;

  SELECT column_name INTO subtitle_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('subtitle','summary','excerpt','short_description','short_text')
  LIMIT 1;

  SELECT column_name INTO category_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('category','type')
  LIMIT 1;

  SELECT column_name INTO active_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('is_active','active','enabled','visible')
  LIMIT 1;

  SELECT column_name INTO order_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('sort_order','display_order','order_index','position','priority')
  LIMIT 1;

  SELECT column_name INTO icon_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('icon','emoji')
  LIMIT 1;

  SELECT column_name INTO created_at_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('created_at','created')
  LIMIT 1;

  SELECT column_name INTO updated_at_col
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name=t AND column_name IN ('updated_at','updated')
  LIMIT 1;

  IF title_col IS NULL THEN
    RAISE EXCEPTION 'Colonna titolo non trovata';
  END IF;

  IF content_col IS NULL THEN
    RAISE EXCEPTION 'Colonna contenuto non trovata';
  END IF;

  FOR g IN
    SELECT *
    FROM (VALUES
      (
        'Backup smartphone: evita brutte sorprese',
        'Backup e sicurezza',
        'backup',
        10,
        'Foto, contatti e chat vanno protetti prima di un guasto o cambio telefono.',
        $txt$Foto, video, contatti e chat possono andare persi in caso di guasto, furto o cambio telefono. Controlla periodicamente che il backup Google, iCloud o WhatsApp sia attivo e aggiornato. Un backup configurato bene ti permette di recuperare i dati più importanti anche se il dispositivo smette di funzionare.

Se non sei sicuro che il backup sia attivo, possiamo verificarlo in negozio.$txt$
      ),
      (
        'WhatsApp: le chat sono davvero salvate?',
        'Backup e sicurezza',
        'whatsapp',
        20,
        'Prima di cambiare smartphone controlla sempre la data dell''ultimo backup.',
        $txt$Il backup di WhatsApp non sempre è attivo in automatico. Apri WhatsApp, entra in Impostazioni, Chat, Backup delle chat e controlla la data dell'ultimo backup. Se è vecchia o assente, rischi di perdere conversazioni, foto e documenti durante un cambio telefono o un ripristino.

Prima di cambiare smartphone, fai sempre controllare il backup.$txt$
      ),
      (
        'Cambio smartphone: preparati prima',
        'Smartphone e tablet',
        'smartphone',
        30,
        'Backup, contatti, WhatsApp, app bancarie e codici vanno verificati prima.',
        $txt$Prima di cambiare telefono, verifica backup foto, contatti, WhatsApp, app bancarie, email e codici di autenticazione. Alcuni servizi richiedono passaggi specifici prima del trasferimento. Prepararsi prima evita blocchi e perdite di dati.

Possiamo seguirti nel passaggio dati dal vecchio al nuovo dispositivo.$txt$
      ),
      (
        'Memoria piena? Non cancellare a caso',
        'Smartphone e tablet',
        'storage',
        40,
        'Una pulizia fatta male può cancellare dati importanti senza risolvere il problema.',
        $txt$Quando lo smartphone segnala memoria piena, evita di eliminare foto o app senza prima controllare cosa occupa davvero spazio. Spesso il problema dipende da video, WhatsApp, download o cache delle app. Una pulizia fatta male può cancellare dati importanti senza risolvere il problema.

Possiamo aiutarti a liberare spazio senza rischiare dati utili.$txt$
      ),
      (
        'Batteria: quando è il momento di controllarla',
        'Smartphone e tablet',
        'battery',
        50,
        'Spegnimenti improvvisi, ricarica lenta e surriscaldamento sono segnali da non ignorare.',
        $txt$Se il telefono si spegne improvvisamente, si scarica troppo in fretta o si surriscalda spesso, la batteria potrebbe essere usurata. Anche caricabatterie e cavi non adatti possono causare problemi di ricarica o ridurre la durata del dispositivo.

Porta con te anche cavo e alimentatore: spesso il problema è lì.$txt$
      ),
      (
        'Garanzia: cosa serve davvero',
        'Garanzia e assistenza',
        'warranty',
        60,
        'Scontrino, data di acquisto, modello e seriale velocizzano l''assistenza.',
        $txt$Per gestire correttamente una pratica di assistenza servono scontrino, data di acquisto, modello e numero seriale o IMEI del prodotto. Conservare questi dati velocizza la verifica della garanzia e riduce i tempi di gestione.

La tua WebApp può aiutarti a tenere traccia delle informazioni utili.$txt$
      ),
      (
        'Notebook lento? Potrebbe non essere da cambiare',
        'PC e notebook',
        'notebook',
        70,
        'Prima di sostituirlo conviene fare una diagnosi mirata.',
        $txt$Un PC lento non è sempre da sostituire. Spesso bastano pulizia software, controllo avvio automatico, verifica disco, aggiornamenti o upgrade mirati come SSD e RAM. Prima di comprare un nuovo notebook, conviene fare una diagnosi.

Una verifica veloce può aiutarti a capire se conviene riparare o sostituire.$txt$
      ),
      (
        'Sicurezza base: aggiornamenti e antivirus',
        'Backup e sicurezza',
        'security',
        80,
        'Aggiornamenti regolari e software affidabili riducono molti rischi.',
        $txt$Mantieni sempre aggiornati sistema operativo, browser e app principali. Gli aggiornamenti correggono problemi di sicurezza e migliorano la stabilità. Evita antivirus sconosciuti o software scaricati da siti non affidabili.

Se il PC mostra popup strani o rallentamenti improvvisi, meglio fare un controllo.$txt$
      ),
      (
        'Accessori compatibili: non sono tutti uguali',
        'Accessori consigliati',
        'accessori',
        90,
        'Cavi, caricabatterie e alimentatori devono essere adatti al dispositivo.',
        $txt$Cavi, caricabatterie, cover, pellicole e alimentatori devono essere compatibili con il dispositivo. Accessori scadenti possono causare ricarica lenta, surriscaldamento o danni nel tempo. Meglio scegliere prodotti adatti al modello e all'uso quotidiano.

In negozio possiamo consigliarti l'accessorio corretto per il tuo dispositivo.$txt$
      ),
      (
        'Prima dell''assistenza: prepara il dispositivo',
        'Garanzia e assistenza',
        'assistenza',
        100,
        'Backup, accessori e dati di sblocco riducono tempi e problemi.',
        $txt$Prima di lasciare un dispositivo in assistenza, salva i dati importanti, rimuovi eventuali blocchi quando richiesto e porta accessori utili alla diagnosi. Per smartphone e tablet può essere necessario conoscere PIN, account o informazioni di sblocco.

Preparare bene il dispositivo riduce tempi e problemi durante la pratica.$txt$
      )
    ) AS v(title, category, icon, sort_order, subtitle, content)
  LOOP
    set_sql := format('%I = %L', content_col, g.content);
    cols_sql := format('%I, %I', title_col, content_col);
    vals_sql := format('%L, %L', g.title, g.content);

    IF subtitle_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = %L', subtitle_col, g.subtitle);
      cols_sql := cols_sql || format(', %I', subtitle_col);
      vals_sql := vals_sql || format(', %L', g.subtitle);
    END IF;

    IF category_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = %L', category_col, g.category);
      cols_sql := cols_sql || format(', %I', category_col);
      vals_sql := vals_sql || format(', %L', g.category);
    END IF;

    IF active_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = TRUE', active_col);
      cols_sql := cols_sql || format(', %I', active_col);
      vals_sql := vals_sql || ', TRUE';
    END IF;

    IF order_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = %s', order_col, g.sort_order);
      cols_sql := cols_sql || format(', %I', order_col);
      vals_sql := vals_sql || format(', %s', g.sort_order);
    END IF;

    IF icon_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = %L', icon_col, g.icon);
      cols_sql := cols_sql || format(', %I', icon_col);
      vals_sql := vals_sql || format(', %L', g.icon);
    END IF;

    IF updated_at_col IS NOT NULL THEN
      set_sql := set_sql || format(', %I = NOW()', updated_at_col);
      cols_sql := cols_sql || format(', %I', updated_at_col);
      vals_sql := vals_sql || ', NOW()';
    END IF;

    IF created_at_col IS NOT NULL THEN
      cols_sql := cols_sql || format(', %I', created_at_col);
      vals_sql := vals_sql || ', NOW()';
    END IF;

    EXECUTE format('UPDATE public.%I SET %s WHERE %I = %L', t, set_sql, title_col, g.title);
    GET DIAGNOSTICS updated_rows = ROW_COUNT;

    IF updated_rows = 0 THEN
      EXECUTE format('INSERT INTO public.%I (%s) VALUES (%s)', t, cols_sql, vals_sql);
    END IF;
  END LOOP;
END
$do$;

COMMIT;