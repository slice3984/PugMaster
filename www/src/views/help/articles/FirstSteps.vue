<template>
  <help-article>
    <template #title>First steps</template>
    <template #default>
      <div class="help-article__section">
        <h2>Creating the pickup channel</h2>
        <p>
          The bot requires a pickup channel which is used to organize pickups
          and execute all commands.
        </p>
        <p>
          The pickup channel can be created using the pickup command, execute
          the following command in the channel you want pickups to happen:
        </p>
        <command-code>!pickup pickup</command-code>
        <p>
          You can create a "listen" channel as well optionally, this channel is
          used for admins / mods only to execute not pickup related commands do
          so by executing the following command in your chosen channel:
        </p>
        <command-code>!pickup listen</command-code>
      </div>
      <div class="help-article__section">
        <h2>Creating a server & assigning it</h2>
        <p>
          To organize pickup servers the bot stores server data which can be
          assigned globally or per pickup, this server is required to point the
          players to the correct server on pickup start, to create a server use
          the create_server command:
        </p>
        <command-code>!create_server pickup 127.0.0.1 password</command-code>
        <p>
          Replace "pickup", "127.0.0.1" and "password" with your desired server
          name, ip and password, the password is optional. One can specify
          different servers for different pickups, or use one server as default
          for all to do so we modify the bot (modify_bot) and assign our created
          server to it:
        </p>
        <command-code>!modify_bot server pickup</command-code>
      </div>
      <div class="help-article__section">
        <h2>Creating pickups</h2>
        <p>
          Now its time to start creating pickups which your players can add to,
          to do so execute the following command in your pickup or listen
          channel:
        </p>
        <command-code>!create_pickups name:players name:players..</command-code>
        <p>
          Replace name with your chosen name and players with the required
          player count.
        </p>
        <p>Example creating a ca and tdm pickup:</p>
        <command-code>!create_pickups ca:10 tdm:10</command-code>
      </div>
      <p>
        Thats it, if you want to modify pickups or the bot further use the
        modify_bot and modify_pickup commands.
      </p>
      <p>
        Reference to the configuration variables can be found in the
        "Configuration variables" section.
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