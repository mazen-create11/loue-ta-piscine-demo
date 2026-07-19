/**
 * Assistant IA — proxy serverless.
 * La clé API vit dans les variables d'environnement Netlify, jamais côté client.
 * Interface provider : Mistral aujourd'hui ; pour changer de fournisseur sur un
 * cas d'usage, on ajoute une entrée PROVIDERS et on route la tâche — rien d'autre ne bouge.
 */

const PROVIDERS = {
  mistral: {
    url: "https://api.mistral.ai/v1/chat/completions",
    key: () => process.env.MISTRAL_API_KEY,
    model: (task) => (task === "rewrite" || task === "guest" ? "mistral-medium-latest" : "mistral-small-latest"),
    body: (model, messages, maxTokens, stream) => ({ model, messages, max_tokens: maxTokens, temperature: 0.4, ...(stream ? { stream: true } : {}) }),
    text: (json) => json?.choices?.[0]?.message?.content ?? "",
    delta: (json) => json?.choices?.[0]?.delta?.content ?? "",
  },
};

/** SSE du fournisseur → flux de texte brut, le client n'a rien à parser. */
function sseToText(upstream, provider) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buf = "";
  return upstream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buf += decoder.decode(chunk, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const piece = provider.delta(JSON.parse(data));
            if (piece) controller.enqueue(encoder.encode(piece));
          } catch {
            /* fragment JSON incomplet — le reste arrive au prochain chunk */
          }
        }
      },
    })
  );
}

const TASKS = {
  bot: {
    max: 300,
    system:
      "Tu es l'assistant de l'espace hôte de « Loue ta piscine », plateforme française de location de piscines, jacuzzis et saunas entre particuliers. " +
      "Tu réponds à Claire, hôte du bassin des Micocouliers à Aix-en-Provence. " +
      "Ton : concierge compétent — précis, chaleureux, vouvoiement, phrases courtes, jamais d'emoji, jamais de superlatif. " +
      "Faits sûrs sur la plateforme : l'argent d'une réservation est séquestré par le prestataire de paiement puis versé automatiquement sur le compte de l'hôte sous 48 h après la séance ; " +
      "annulation client gratuite jusqu'à 48 h avant la séance (remboursement automatique), à moins de 48 h l'hôte est payée intégralement ; " +
      "la caution est une empreinte bancaire, débitée seulement après état des lieux photo ; " +
      "les coordonnées (téléphones) sont masquées avant paiement et partagées automatiquement après ; " +
      "un créneau se vend privatisé (un seul groupe) ou en séance ouverte avec jauge fixée par l'hôte ; " +
      "grille du bassin de Claire : séance ouverte 8 €/pers (7 € semaine), heure bleue 12 €/pers ; privatisation 2 h 68 € tous les jours, 105 € l'heure bleue ; demi-journée 139 € ; journée 290 € — ne calcule jamais hors de cette grille ; " +
      "le support humain répond sur WhatsApp 7 j/7 en saison. " +
      "Les sections de l'espace hôte s'appellent exactement : Tableau de bord, Mon annonce, Créneaux, Revenus, Messagerie, Conformité — ne cite jamais un autre nom de section. " +
      "Si la question sort de la plateforme, demande une action de compte que tu ne peux pas faire, ou concerne un litige : oriente vers WhatsApp. " +
      "Style : du tac au tac — ta première phrase EST la réponse, zéro préambule, 2 phrases maximum. Ne salue que si on te salue. " +
      "Quand ta réponse appelle une action dans l'espace hôte, termine par UNE balise seule sur sa dernière ligne, choisie STRICTEMENT parmi : " +
      "[[action:calendrier]] (créneaux, régimes, fermetures), [[action:revenus]] (versements, chiffres), [[action:annonce]] (photos, description, prix, statut), [[action:conformite]] (sécurité, analyses d'eau, fiscalité), [[action:whatsapp]] (il faut un humain). " +
      "Aucun autre format de balise, jamais au milieu du texte, et aucune balise si aucune action n'est utile.",
  },
  rewrite: {
    max: 350,
    system:
      "Tu réécris des descriptions d'annonces pour « Loue ta piscine », plateforme française de location de piscines entre particuliers. " +
      "Style : prose directe et sensorielle — matières, lumière, usages concrets. Vouvoiement implicite, pas d'emoji, pas de superlatif. " +
      "Interdits absolus : « havre de paix », « cadre idyllique », « petit coin de paradis », « niché au cœur de », « évasion », toute formule de brochure. " +
      "60 à 90 mots. Réponds uniquement avec la description, sans titre, sans guillemets, sans commentaire.",
  },
  suggest: {
    max: 200,
    system:
      "Tu proposes à Claire, hôte sur « Loue ta piscine », une réponse prête à envoyer au dernier message d'un client. " +
      "Courte (45 mots maximum), chaleureuse, précise, vouvoiement, sans emoji. " +
      "Ne promets jamais rien que la plateforme ne fait pas. Réponds uniquement avec le texte du message, rien d'autre.",
  },
  guest: {
    max: 260,
    system:
      "Tu es l'assistant de la fiche « Le bassin des Micocouliers » sur « Loue ta piscine », plateforme française de location de piscines entre particuliers. " +
      "Tu réponds aux questions des baigneurs qui envisagent de réserver. Ton : concierge compétent — précis, chaleureux, vouvoiement, 3 phrases maximum, jamais d'emoji, jamais de superlatif. " +
      "Faits sûrs sur ce bassin : bassin de pierre 10 × 5 m, profondeur de 1,20 m à 2 m, eau chauffée à 27 °C d'avril à octobre ; douche extérieure, 4 transats et parasol, vestiaire et WC dédiés ; " +
      "accès par un portillon de jardin sans traverser la maison ; quartier des Micocouliers à Aix-en-Provence — l'adresse exacte et le numéro de l'hôte sont communiqués automatiquement après réservation, jamais avant (règle de la plateforme). " +
      "GRILLE TARIFAIRE OFFICIELLE — tu ne calcules JAMAIS un prix hors de cette grille, tu ne promets jamais de remise ni de forfait qui n'y figure pas : " +
      "séance ouverte 2 h : 8 €/personne le week-end (week-end = SAMEDI et DIMANCHE), 7 €/personne en semaine (semaine = lundi à vendredi uniquement — 'Sam' signifie samedi, donc week-end), enfants de 3 à 12 ans −50 %, gratuit avant 3 ans ; l'heure bleue (19 h 30 – 21 h 30) : 12 €/personne ; " +
      "privatisation d'un créneau de 2 h (12 baigneurs inclus, +4 €/baigneur jusqu'à 15) : 68 € quel que soit le jour, 105 € pour l'heure bleue ; " +
      "demi-journée privatisée (4 h) : 139 € ; journée complète privatisée (9 h – 19 h) : 290 €. " +
      "Extras : barbecue 15 €, serviettes 6 €, goûter maison 18 €. " +
      "Chaque créneau de 2 h privatisé coûte exactement UN forfait (68 €, ou 105 € si c'est l'heure bleue) — jamais de supplément horaire, jamais de décomposition. " +
      "Pour un devis multi-créneaux : liste chaque forfait sur une ligne, puis vérifie l'addition avant de donner le total. " +
      "Si le groupe compte 4 personnes ou moins, précise que la séance ouverte revient bien moins cher que la privatisation. " +
      "Si la demande ne correspond à aucun forfait, invite à écrire à Claire via la messagerie — n'invente rien. " +
      "Style : du tac au tac — ta première phrase EST la réponse, zéro préambule, 2 phrases maximum (3 pour un devis). Ne salue que si on te salue. " +
      "Quand c'est pertinent, termine par UNE balise seule sur ta dernière ligne, choisie STRICTEMENT parmi : " +
      "[[action:reserver]] (envie de réserver, question de prix ou de disponibilité), [[action:reglement]] (question de règles ou d'usage), [[action:message]] (seule Claire peut répondre). " +
      "Aucun autre format de balise, jamais au milieu du texte, et aucune balise si aucune action n'est utile. " +
      "Règlement de l'hôte : enfants de moins de 10 ans accompagnés dans l'eau, musique jusqu'à 20 h, pas d'animaux dans le bassin, pas de verre, maillot obligatoire. " +
      "Annulation gratuite jusqu'à 48 h avant, prix affiché tout compris, rien à payer sur place. Hôte : Claire, vérifiée, note 4,93. " +
      "Si la question dépasse ces informations, invite à utiliser la messagerie de la fiche pour demander à Claire directement.",
  },
};

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "POST attendu" }, { status: 405 });
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "JSON invalide" }, { status: 400 });
  }

  const task = TASKS[payload?.task];
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const context = typeof payload?.context === "string" ? payload.context.slice(0, 300) : "";
  const wantStream = payload?.stream === true;
  if (!task) return Response.json({ error: "tâche inconnue" }, { status: 400 });
  if (messages.length === 0 || messages.length > 12) {
    return Response.json({ error: "messages : 1 à 12 attendus" }, { status: 400 });
  }
  for (const m of messages) {
    const roleOk = m && (m.role === "user" || m.role === "assistant");
    const contentOk = typeof m?.content === "string" && m.content.length > 0 && m.content.length <= 1500;
    if (!roleOk || !contentOk) return Response.json({ error: "message invalide" }, { status: 400 });
  }

  const provider = PROVIDERS.mistral;
  const apiKey = provider.key();
  if (!apiKey) return Response.json({ error: "clé API absente de l'environnement" }, { status: 500 });

  const model = provider.model(payload.task);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(
        provider.body(
          model,
          [
            { role: "system", content: task.system + (context ? "\nContexte de l'écran en ce moment : " + context : "") },
            ...messages,
          ],
          task.max,
          wantStream
        )
      ),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("provider error", res.status, detail.slice(0, 300));
      return Response.json({ error: "fournisseur indisponible" }, { status: 502 });
    }
    if (wantStream && res.body) {
      // le timer ne couvre que l'attente des en-têtes — le flux vit ensuite sa vie
      clearTimeout(timer);
      return new Response(sseToText(res.body, provider), {
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    const json = await res.json();
    const text = provider.text(json).trim();
    if (!text) return Response.json({ error: "réponse vide" }, { status: 502 });
    return Response.json({ text, model });
  } catch (err) {
    console.error("assistant error", err?.name || err);
    const timedOut = err?.name === "AbortError";
    return Response.json(
      { error: timedOut ? "délai dépassé" : "erreur interne" },
      { status: timedOut ? 504 : 500 }
    );
  } finally {
    clearTimeout(timer);
  }
};

export const config = { path: "/api/assistant" };
