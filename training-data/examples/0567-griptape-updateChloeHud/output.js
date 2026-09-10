function updateChloeHud() {
  if (!chloe.active) return;
  elChloeFeed.style.opacity = '1';
  elChloeFollHud.textContent = chloe.followers.toLocaleString() + ' followers';

  const gap = chloe.followers - followers;
  if (gap > 0) {
    elChloeGap.textContent = '▲ Chloe leads by ' + gap.toLocaleString();
    elChloeGap.style.color = '#ef5350';
  } else {
    elChloeGap.textContent = '▼ You lead by ' + Math.abs(gap).toLocaleString() + '!';
    elChloeGap.style.color = '#aed581';
  }

  // Feed: last post type hint
  const lastPost = document.querySelector('#sg-feed .sg-post');
  if (lastPost && lastPost.textContent.includes('CHLOE')) {
    elChloeLastPost.textContent = lastPost.textContent.slice(0, 50) + '...';
  }

  // Bar shows player/chloe ratio
  const total = Math.max(1, followers + chloe.followers);
  const playerFrac = followers / total * 100;
  elChloeBar.style.width = playerFrac + '%';
  elChloeBar.style.background = playerFrac > 50 ? '#aed581' : '#f06292';
}