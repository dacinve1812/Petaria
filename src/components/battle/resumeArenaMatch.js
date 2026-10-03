/** Điều hướng lại trận Redis (1v1 hoặc 3v3/5v5) sau khi mất kết nối. */
export function isSquadMatch(match) {
  return match?.squad === true || match?.battleMode === '3v3' || match?.battleMode === '5v5';
}

export function resumeMatchState(match) {
  if (!match) return null;
  if (isSquadMatch(match)) {
    return {
      matchState: match,
      playerPet: match.player,
      enemyPet: match.enemy,
      useRedisMatch: false,
      squadPersist: true,
      battleSource: match.battleSource || 'champion',
      returnPath: match.returnPath || '/battle/champion',
      battleMode: match.battleMode,
      formationId: match.formationId,
      enemyFormationId: match.enemyFormationId,
      playerTeam: match.playerSquad,
      enemyTeam: match.enemySquad,
    };
  }
  return {
    matchState: match,
    playerPet: match.player,
    enemyPet: match.enemy,
    useRedisMatch: true,
    battleSource: match.battleSource || 'arena',
    returnPath: match.returnPath || '/battle/arena',
    huntingMapId: match.huntingMapId || null,
    fromHunting: match.battleSource === 'hunting',
    battleMode: match.battleMode || '1v1',
  };
}
