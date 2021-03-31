<template>
  <help-article>
    <template #title>How does rating work?</template>
    <template #default>
      <div class="help-article__block">
        <h2>Introduction</h2>
        <p>
          This section will describe how a pickup can be rated as user or admin.
        </p>
      </div>
      <div class="help-article__block">
        <h2>Reporting wins, draws and losses</h2>
        <p>
          To be able to report a certain result for a pickup the player has to
          be a captain of the pickup to be rated.
        </p>
        <p>
          Only pickups in rated mode in "manual" pickmode with player picked
          teams are rateable by players.
        </p>
        <p>
          To report a outcome the following commands are available to players:
          reportdraw and reportloss.
        </p>
        <p>
          For example, when team A loses the captain of team A executes the
          reportloss command to report a loss for his team.
        </p>
        <p>
          In case of pickups with more than two teams or reporting a draw other
          captains have to confirm by reporting as well.
        </p>
      </div>
      <div class="help-article__section">
        <h2>Rating & Unrating pickups as admin</h2>
        <p>
          With sufficient permissions admins are able to use the rate and unrate
          commands.
        </p>
        <p>Rating or rerating can be done with the rate command, example:</p>
        <command-code>!rate 231 A:W B:L</command-code>
        <p>
          Rates or rerates the pickup with the id 231 and reports a win for Team
          A and a loss for team B.
        </p>
        <p>Possible outcomes are W - Win, D - Draw, L - Loss.</p>
        <p>Using the unrate command it is also possible to unrate a pickup:</p>
        <command-code>!unrate 231 </command-code>
        <p>
          Executing this command results in unrating the pickup with the id 231.
        </p>
      </div>
      <p>
        Due to its nature of how the rating works internally the bot can only
        rate, rerate or unrate pickups up to 10 already rated pickups in the
        past.
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