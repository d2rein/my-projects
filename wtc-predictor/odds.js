(function () {
  const model = window.WTC_MODEL;
  const strengthKeys = ["strong", "favoured", "slight", "even"];
  const lengths = [5, 3, 2];
  const mount = document.getElementById("odds-sections");

  mount.innerHTML = lengths.map((length) => `
    <section class="panel">
      <h2>${length}-Test Series</h2>
      <p class="small-note">Home and away are mirrored. A strong away series uses the same probabilities as a strong home series with the teams swapped.</p>
      <div class="grid" id="grid-${length}"></div>
    </section>
  `).join("");

  for (const length of lengths) {
    const grid = document.getElementById(`grid-${length}`);
    grid.innerHTML = strengthKeys.map((strength) => renderStrengthCard(length, strength)).join("");
  }

  function renderStrengthCard(length, strength) {
    const label = strength.charAt(0).toUpperCase() + strength.slice(1);
    const probabilities = model.getScorelineProbabilities(length, `${strength}_home`);
    const perMatch = model.getPerMatchDistribution(length, `${strength}_home`);
    return `
      <article class="card">
        <h3>${label}</h3>
        <div class="small-note">
          Per Test: ${formatPercent(perMatch.homeWin)} home win, ${formatPercent(perMatch.draw)} draw, ${formatPercent(perMatch.awayWin)} away win
        </div>
        <div class="table-shell">
          <table>
            <thead>
              <tr>
                <th>Scoreline</th>
                <th>Probability</th>
              </tr>
            </thead>
            <tbody>
              ${probabilities.map((row) => `
                <tr>
                  <td>${row.homeWins}-${row.draws}-${row.awayWins}</td>
                  <td>${formatPercent(row.probability)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  function formatPercent(value) {
    return `${(value * 100).toFixed(2)}%`;
  }
})();
