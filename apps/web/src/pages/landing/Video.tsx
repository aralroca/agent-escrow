import { useState } from 'react';

const VIDEO_ID = 'xDRvH4vOc24';
const TITLE = 'Agent Escrow: a real job on Solana devnet, paid and refunded';
const POSTER = `${import.meta.env.BASE_URL}promo-thumbnail.png`;

/** YouTube is only contacted once the visitor presses play. */
function Player() {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
        title={TITLE}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    );
  }

  return (
    <button type="button" aria-label="Play the video" onClick={() => setPlaying(true)}>
      <img src={POSTER} alt="" loading="lazy" />
      <span className="video-play" />
    </button>
  );
}

export function Video() {
  return (
    <section id="video" className="container stack section section-tight">
      <div className="stack section-head">
        <span className="eyebrow">See it work</span>
        <h2 className="h2">Two real jobs in two minutes.</h2>
        <p className="lead">
          One delivery passes the test and the seller is paid. One falls short and the buyer is
          refunded. Every arrow is a real transaction on Solana devnet.
        </p>
      </div>
      <div className="video">
        <Player />
      </div>
      <a href={`https://youtu.be/${VIDEO_ID}`} target="_blank" rel="noreferrer">
        Watch on YouTube →
      </a>
    </section>
  );
}
