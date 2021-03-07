<template>
  <help-article>
    <template #title>Setting up rating / elo</template>
    <div class="help-article__section">
      <h2>How to setup pickup rating</h2>
      <p>
        The bot uses
        <base-link link mode="bold" to="https://trueskill.org/"
          >trueskill</base-link
        >
        for its rating system. To make a pickup rateable the pickup has to be in
        a pickmode which is able to generate teams.
      </p>
      <p>
        The following pickmodes are suitable for rated mode: manual, random, elo
        and autopick.
      </p>
      <p>
        To modify a pickup to use a different pickmode you use the modify_pickup
        command, example:
      </p>
      <command-code>!modify_pickup name pickmode manual </command-code>
      <p>
        Now that our pickup is able to generate teams we enable rating using the
        modify_pickup command once again:
      </p>
      <command-code>!modify_pickup name rated true</command-code>
      <p>
        Executing both commands results in having a pickup with teams being able
        to be rated using the rating commands.
      </p>
    </div>
    More info about rating a pickup can be found
    <base-link mode="bold" to="/help/ratinghelp">here</base-link>.
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