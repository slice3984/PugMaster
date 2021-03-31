<template>
  <help-article>
    <template #title>Pickmodes explained</template>
    <template #default>
      <div class="help-article__block">
        <h2>Introduction</h2>
        <p>
          The bot offers various pickmodes which are explained in this chapter.
        </p>
        <p>
          To change the pickmode of a specific pickup the modify_pickup command
          is used, example:
        </p>
        <command-code>!modify_pickup name pickmode manual </command-code>
        <p>Sets the pickmode for pickup "name" to manual.</p>
        <p>The following pickmodes are available:</p>
      </div>
      <div class="help-article__block">
        <h2>no_teams</h2>
        <p>
          The default pickmode for pickups, no team generation for pickups with
          more than two players.
        </p>
        <p>
          Pickups with two players are treated as two team pickups and are able
          to be rated with enabled rated mode.
        </p>
      </div>
      <div class="help-article__block">
        <h2>manual</h2>
        <p>
          Pickups in this mode enable player picking. The bot selects the
          required amount of captains based on the captain role and amount of
          played pickups.
        </p>
        <p>
          If a player got a captain role for the given pickup, the player will
          be prioritized over players with more played games.
        </p>
        <p>
          In this mode each captain picks players for his team if no players are
          left the pickup starts with the picked teams.
        </p>
      </div>
      <div class="help-article__block">
        <h2>random</h2>
        <p>The bot generates random teams for the given pickup.</p>
      </div>
      <div class="help-article__block">
        <h2>elo</h2>
        <p>
          The bot attempts to generate balanced teams based on the available
          player ratings.
        </p>
      </div>
      <h2>autopick</h2>
      <p>
        Combines manual and elo pickmode, if a certain max average player elo
        variance threshold is exceeded the pickup will start in manual pickmode.
      </p>
      <p>Otherwise the bot generates teams in elo pickmode.</p>
      <p>
        The max average elo value can be set with the modify_bot command,
        example:
      </p>
      <command-code>!modify_bot max_avg_elo_variance 32 </command-code>
      <p>
        Sets the max average elo variance to 32, if the average player elo
        variance is exceeded in a autopick pickup manaul pickmode will be used.
      </p>
    </template>
  </help-article>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HelpArticle from "@/components/help/HelpArticle.vue";
import CommandCode from "@/components/CommandCode.vue";

export default defineComponent({
  components: { HelpArticle, CommandCode },
});
</script>