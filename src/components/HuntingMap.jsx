import React, { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import Phaser from 'phaser';
import PreloadScene from '../game/scenes/PreloadScene';
import MainScene from '../game/scenes/MainScene';
import './HuntingMap.css';

function HuntingMap() {
  const gameRef = useRef(null);
  const containerRef = useRef(null);
  const { id } = useParams();

  useEffect(() => {
    // Create Phaser game instance on mount
    const config = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 1000,
      height: 700,
      backgroundColor: '#1b1f2a',
      pixelArt: true,
      physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false },
      },
      // Pass selected map id via scene data
      scene: [new PreloadScene({ selectedMapId: id }), new MainScene({ selectedMapId: id })],
    };

    gameRef.current = new Phaser.Game(config);

    return () => {
      // Clean up Phaser instance on unmount
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [id]);

  return (
    <div className="hunting-map-wrapper">
      <div ref={containerRef} className="hunting-map-root" />
    </div>
  );
}

export default HuntingMap;


