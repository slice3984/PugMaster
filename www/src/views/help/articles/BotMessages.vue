<template>
  <help-article>
    <template #title>Setting start, notify and sub messages</template>
    <template #default>
      <div class="help-article__block">
        <p>
          The bot offers a few placeholder variables to set a custom message for
          the start, notify and sub message.
        </p>
        <p>The following variables are available:</p>
      </div>
      <div class="help-article__block">
        <table class="help-article__table">
          <thead>
            <th>Variable</th>
            <th>Description</th>
            <th>Usable for</th>
          </thead>
          <tbody>
            <tr>
              <td>%name</td>
              <td>Name of the pickup</td>
              <td>start, notify and sub</td>
            </tr>
            <tr>
              <td>%ip</td>
              <td>Server ip for the pickup</td>
              <td>start, notify and sub</td>
            </tr>
            <tr>
              <td>%password</td>
              <td>Server password for the pickup</td>
              <td>start, notify and sub</td>
            </tr>
            <tr>
              <td>%teams</td>
              <td>Teams of the pickup</td>
              <td>start</td>
            </tr>
            <tr>
              <td>%map</td>
              <td>Random map for the pickup</td>
              <td>start</td>
            </tr>
            <tr>
              <td>%pickmode</td>
              <td>Pickmode for the pickup</td>
              <td>start</td>
            </tr>
            <tr>
              <td>%drawchance</td>
              <td>Probability in % for each team to draw</td>
              <td>start</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="help-article__block">
        <p>The messages can be modified using the modify_bot command:</p>
        <command-code
          >!modify_bot start_message %name pickup started, IP: %ip Password:
          %password
        </command-code>
        <p>
          Results in modifying the start message and replacing the placeholders
          with the correct values in case of a pickup start.
        </p>
        <p>
          If no value is available the placeholder will be deleted without a
          replacement.
        </p>
      </div>
      <p>
        It is also possible to only show a certain text if a placeholder is
        available this is achievable with the following syntax:
      </p>
      <p>%name pickup started, IP: %ip %password[Password: %password]</p>
      <p>
        This will only display the "Password: %password" part if a password is
        set.
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