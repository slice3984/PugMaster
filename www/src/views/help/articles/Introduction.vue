<template>
  <help-article>
    <template #title>Introduction for players new to pickups</template>
    <template #default>
      <div class="help-article__block">
        <h2>How do pickups work?</h2>
        <p>This bot is used to organize pickups/matches on a discord server.</p>
        <p>
          After a pickup reached its maximum player capacity the pickup will
          start and show the server you have to connect to.
        </p>
        <p>
          (In case of enabled afk check you have to !ready when the bot asks for
          it)
        </p>
      </div>
      <div class="help-article__block">
        <p>You can add to a pickup using the following command:</p>
        <command-code>!add pickup </command-code>
        <p>
          Executing this command results in adding you to the pickup queue for
          the pickup "pickup".
        </p>
        <p>To remove from a pickup you use:</p>
        <command-code>!remove pickup </command-code>
        <p>
          It is also possible to pass multiple pickups to the add and remove
          commands, examples:
        </p>
        <command-code>!add pickup1 pickup2</command-code>
        <command-code>!remove pickup1 pickup2</command-code>
        <p>
          Calling add or remove without arguments results in adding to default &
          active pickups or removing from all pickups you added to.
        </p>
        <p>You can also replace !add and !remove by + or -, examples:</p>
        <command-code>+pickup1 pickup2</command-code>
        <command-code>-pickup1 pickup2</command-code>
      </div>
      <div class="help-article__section">
        <p>To list available pickups you can add to you use:</p>
        <command-code>!pickups</command-code>
        <p>To display all added players:</p>
        <command-code>!who</command-code>or
        <command-code>??</command-code>
        <p>
          To set a time limit after the bot auto removes you from all pickups
          you added to:
        </p>
        <command-code>!expire time</command-code>
        <p>
          time has to be replaced with a time string in the following format: 1h
          2m (1 hour 2 minutes).
        </p>
        <p>If you add on mobile it is recommended to use the</p>
        <command-code>!ao</command-code>
        <p>command which prevents removal on offline status.</p>
      </div>
      A complete command reference can be found here:
      <base-link to="/commands" mode="bold">commands</base-link>
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