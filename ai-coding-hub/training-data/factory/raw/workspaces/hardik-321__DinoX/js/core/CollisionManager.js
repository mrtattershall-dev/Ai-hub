export class CollisionManager {

    static check(player, enemyManager) {

        const playerBox = player.getHitbox();

        for (const enemy of enemyManager.enemies) {

            const enemyBox = enemy.getHitbox();

            const collision =

                playerBox.x < enemyBox.x + enemyBox.width &&
                playerBox.x + playerBox.width > enemyBox.x &&
                playerBox.y < enemyBox.y + enemyBox.height &&
                playerBox.y + playerBox.height > enemyBox.y;

            if (collision) {

                return true;

            }

        }

        return false;

    }

}